"""Integración con OneDrive personal via Microsoft Graph API (delegated auth)."""
import logging
from datetime import date

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GRAPH_BASE     = "https://graph.microsoft.com/v1.0"
TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
BUCKET         = "informe-imagenes"

MESES = {
    "01": "Enero", "02": "Febrero", "03": "Marzo",    "04": "Abril",
    "05": "Mayo",  "06": "Junio",   "07": "Julio",    "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
}


def _get_token() -> str | None:
    """Obtiene un access token usando el refresh token almacenado."""
    if not all([settings.azure_client_id, settings.azure_client_secret, settings.azure_refresh_token]):
        return None
    try:
        resp = httpx.post(
            TOKEN_ENDPOINT,
            data={
                "grant_type":    "refresh_token",
                "client_id":     settings.azure_client_id,
                "client_secret": settings.azure_client_secret,
                "refresh_token": settings.azure_refresh_token,
                "scope":         "https://graph.microsoft.com/Files.ReadWrite offline_access",
            },
            timeout=10,
        )
        data = resp.json()
        if "access_token" not in data:
            logger.error("OneDrive: no se pudo refrescar el token: %s", data.get("error_description", data))
            return None
        return data["access_token"]
    except Exception as exc:
        logger.warning("OneDrive: error al obtener token: %s", exc)
        return None


def _clean(s: str) -> str:
    return (s or "").replace("/", "-").replace("\\", "-").replace(":", "-").strip()


def _carpeta_base(informe: dict, paciente: dict) -> str:
    """Construye la ruta base del informe en OneDrive."""
    fecha  = str(informe.get("fecha_estudio", "") or "")
    partes = fecha.split("-")
    year   = partes[0] if len(partes) > 0 else "sin-fecha"
    month  = MESES.get(partes[1], partes[1]) if len(partes) > 1 else "sin-mes"

    apellido   = _clean(paciente.get("apellido") or "Desconocido")
    nombre_pac = _clean(paciente.get("nombre") or "")
    paciente_folder = f"{apellido}, {nombre_pac}" if nombre_pac else apellido

    tipo = _clean(informe.get("tipo_estudio") or "Informe")[:50]

    return f"Informes IDM/{year}/{month}/{paciente_folder}/{tipo}"


def _upload(token: str, onedrive_path: str, content: bytes, content_type: str) -> bool:
    resp = httpx.put(
        f"{GRAPH_BASE}/me/drive/root:/{onedrive_path}:/content",
        content=content,
        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
        timeout=60,
    )
    if resp.is_success:
        return True
    logger.error("OneDrive: upload falló (%s): %s — %s", onedrive_path, resp.status_code, resp.text)
    return False


def subir_informe_a_onedrive(
    pdf_bytes: bytes,
    informe: dict,
    paciente: dict,
    editado: bool = False,
) -> None:
    """Sube el PDF y las imágenes del informe a OneDrive. Background task.

    Estructura:
        Informes IDM/{año}/{Mes}/{Apellido, Nombre}/{Tipo}/
            {Tipo}_{fecha}_{id[:8]}.pdf
            {Tipo}_{fecha}_{id[:8]}_editado_{hoy}.pdf   (si editado=True)
            imagenes/
                {nombre_imagen}
    """
    token = _get_token()
    if not token:
        return

    try:
        carpeta   = _carpeta_base(informe, paciente)
        tipo      = _clean(informe.get("tipo_estudio") or "Informe")[:50]
        informe_id = str(informe.get("id", ""))[:8]
        fecha_est = str(informe.get("fecha_estudio", "") or "").replace("-", "")  # 20260330

        if editado:
            hoy = date.today().strftime("%Y%m%d")
            filename = f"{tipo}_{fecha_est}_{informe_id}_editado_{hoy}.pdf"
        else:
            filename = f"{tipo}_{fecha_est}_{informe_id}.pdf"

        pdf_path = f"{carpeta}/{filename}"
        if _upload(token, pdf_path, pdf_bytes, "application/pdf"):
            logger.info("OneDrive PDF: %s", pdf_path)

        # Subir imágenes desde Supabase Storage
        _subir_imagenes(token, str(informe.get("id", "")), carpeta)

    except Exception as exc:
        logger.warning("OneDrive: error general (informe=%s): %s", informe.get("id"), exc)


def _subir_imagenes(token: str, informe_id: str, carpeta_base: str) -> None:
    """Descarga las imágenes del informe desde Supabase y las sube a OneDrive."""
    try:
        from app.dependencies import get_admin_client
        admin = get_admin_client()
        files = admin.storage.from_(BUCKET).list(informe_id) or []
    except Exception as exc:
        logger.warning("OneDrive: no se pudieron listar imágenes (informe=%s): %s", informe_id, exc)
        return

    for f in files:
        nombre = f.get("name", "")
        if not nombre:
            continue
        storage_path = f"{informe_id}/{nombre}"
        try:
            img_bytes = admin.storage.from_(BUCKET).download(storage_path)
            ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else "jpg"
            content_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                            "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
            onedrive_path = f"{carpeta_base}/imagenes/{nombre}"
            if _upload(token, onedrive_path, img_bytes, content_type):
                logger.info("OneDrive imagen: %s", onedrive_path)
        except Exception as exc:
            logger.warning("OneDrive: no se pudo subir imagen %s: %s", nombre, exc)


# Alias para compatibilidad con el router de finalizar
def subir_pdf_onedrive(pdf_bytes: bytes, informe: dict, paciente: dict) -> None:
    subir_informe_a_onedrive(pdf_bytes, informe, paciente, editado=False)
