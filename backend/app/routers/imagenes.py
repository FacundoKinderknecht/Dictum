import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app.dependencies import get_supabase_for_user, get_admin_client
from app.dependencies import require_role

router = APIRouter()
logger = logging.getLogger(__name__)

BUCKET = "informe-imagenes"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 10

_medico = require_role("medico")


def _verificar_acceso_informe(client, informe_id: str, usuario_id: str, solo_propietario: bool = False) -> None:
    """Verifica que el usuario tiene acceso al informe (propio o con permiso). Lanza 404 si no."""
    informe = client.table("informes").select("medico_id").eq("id", informe_id).execute()
    if not informe.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")
    medico_id = informe.data[0]["medico_id"]
    if medico_id == usuario_id:
        return
    if solo_propietario:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este informe")
    acceso = get_admin_client().table("accesos_medico").select("usuario_id").eq("usuario_id", usuario_id).eq("medico_id", medico_id).execute()
    if not acceso.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este informe")


@router.post("/{informe_id}/imagenes")
def subir_imagen(
    informe_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(_medico),
):
    """Sube una imagen al bucket de Supabase Storage asociada al informe."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Solo se permiten imágenes JPEG, PNG o WebP",
        )

    contents = file.file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera el límite de {MAX_SIZE_MB} MB",
        )

    client = get_supabase_for_user(current_user["token"])
    # Solo el propietario puede subir imágenes
    _verificar_acceso_informe(client, informe_id, current_user["id"], solo_propietario=True)

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = f"{informe_id}/{filename}"

    admin_client = get_admin_client()
    try:
        admin_client.storage.from_(BUCKET).upload(
            path=path,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": "false"},
        )
    except Exception as exc:
        logger.error("Storage upload failed (bucket=%s path=%s): %s", BUCKET, path, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al subir la imagen",
        ) from exc

    # Generar URL firmada (1 hora)
    signed = admin_client.storage.from_(BUCKET).create_signed_url(path, 3600)
    return {
        "path": path,
        "url": signed["signedURL"],
        "nombre": file.filename,
    }


@router.get("/{informe_id}/imagenes")
def listar_imagenes(
    informe_id: str,
    current_user: dict = Depends(_medico),
):
    """Lista las imágenes de un informe con URLs firmadas."""
    client = get_supabase_for_user(current_user["token"])
    _verificar_acceso_informe(client, informe_id, current_user["id"])

    admin_client = get_admin_client()
    try:
        files = admin_client.storage.from_(BUCKET).list(informe_id)
    except Exception:
        return []

    result = []
    for f in (files or []):
        path = f"{informe_id}/{f['name']}"
        try:
            signed = admin_client.storage.from_(BUCKET).create_signed_url(path, 3600)
            result.append({
                "path": path,
                "url": signed["signedURL"],
                "nombre": f["name"],
            })
        except Exception:
            continue

    return result


@router.delete("/{informe_id}/imagenes/{filename}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_imagen(
    informe_id: str,
    filename: str,
    current_user: dict = Depends(_medico),
):
    """Elimina una imagen del bucket."""
    client = get_supabase_for_user(current_user["token"])
    # Solo el propietario puede eliminar imágenes
    _verificar_acceso_informe(client, informe_id, current_user["id"], solo_propietario=True)

    path = f"{informe_id}/{filename}"
    admin_client = get_admin_client()
    try:
        admin_client.storage.from_(BUCKET).remove([path])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la imagen",
        ) from exc
