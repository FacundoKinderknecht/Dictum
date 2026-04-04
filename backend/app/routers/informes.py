import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.dependencies import get_admin_client, get_client_ip, get_supabase_for_user, require_role

logger = logging.getLogger(__name__)
from app.schemas.informe import InformeConPaciente, InformeCreate, InformeOut, InformeUpdate
from app.services import audit_service
from app.services.informe_service import assert_borrador, get_informe_or_404
from app.services.pdf_service import generar_pdf
from app.services.onedrive_service import subir_pdf_onedrive, subir_informe_a_onedrive

router = APIRouter()

_medico     = require_role("medico")
_secretaria = require_role("secretaria")


def _get_acceso(usuario_id: str, medico_id: str) -> dict | None:
    """Retorna el registro de accesos_medico si existe, None si no."""
    try:
        result = get_admin_client().table("accesos_medico").select("puede_editar").eq("usuario_id", usuario_id).eq("medico_id", medico_id).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


# ── Rutas del médico ──────────────────────────────────────────────────────────

@router.get("/mis-informes", response_model=list[InformeConPaciente])
def listar_mis_informes(
    current_user: dict = Depends(_medico),
) -> list[InformeConPaciente]:
    """Retorna todos los informes del médico autenticado con datos del paciente."""
    client = get_supabase_for_user(current_user["token"])

    result = (
        client.table("informes")
        .select(
            "*, "
            "pacientes(nombre, apellido, dni, fecha_nacimiento), "
            "profiles(nombre, apellido)"
        )
        .eq("medico_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    rows = result.data or []
    return [_flatten_informe(r) for r in rows]


@router.post("", response_model=InformeOut, status_code=status.HTTP_201_CREATED)
def crear_informe(
    request: Request,
    body: InformeCreate,
    current_user: dict = Depends(_medico),
) -> InformeOut:
    """Crea un informe en estado 'borrador'."""
    client = get_supabase_for_user(current_user["token"])

    # Verifica que el paciente existe y pertenece al alcance del médico
    pac = client.table("pacientes").select("id").eq("id", str(body.paciente_id)).execute()
    if not pac.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    # mode="json" serializa UUID→str y date→ISO string automáticamente
    payload = body.model_dump(exclude_none=True, mode="json")
    payload["paciente_id"] = str(body.paciente_id)
    payload["medico_id"] = current_user["id"]
    payload["estado"] = "borrador"

    try:
        result = client.table("informes").insert(payload).execute()
    except Exception as exc:
        logger.error("Error al crear informe: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el informe",
        )

    nuevo = result.data[0]

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.CREAR_INFORME,
        tabla_afectada="informes",
        registro_id=nuevo["id"],
        detalle={"tipo_estudio": body.tipo_estudio, "paciente_id": str(body.paciente_id)},
        ip_address=get_client_ip(request),
    )

    return nuevo


@router.get("/por-medico/{medico_id}", response_model=list[InformeConPaciente])
def listar_informes_por_medico(
    medico_id: str,
    current_user: dict = Depends(_medico),
) -> list[InformeConPaciente]:
    """Retorna todos los informes de un médico específico (propio o con acceso)."""
    # Verificar que sea el propio médico o que tenga acceso asignado
    if medico_id != current_user["id"]:
        if not _get_acceso(current_user["id"], medico_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a los informes de este médico")

    client = get_supabase_for_user(current_user["token"])

    result = (
        client.table("informes")
        .select(
            "*, "
            "pacientes(nombre, apellido, dni, fecha_nacimiento), "
            "profiles(nombre, apellido)"
        )
        .eq("medico_id", medico_id)
        .order("created_at", desc=True)
        .execute()
    )

    rows = result.data or []
    return [_flatten_informe(r) for r in rows]


@router.get("/{informe_id}", response_model=InformeConPaciente)
def get_informe(
    informe_id: str,
    current_user: dict = Depends(_medico),
) -> InformeConPaciente:
    """Retorna un informe con datos del paciente (propio o con acceso de lectura)."""
    client = get_supabase_for_user(current_user["token"])

    try:
        result = (
            client.table("informes")
            .select(
                "*, "
                "pacientes(nombre, apellido, dni, fecha_nacimiento), "
                "profiles(nombre, apellido)"
            )
            .eq("id", informe_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    informe = result.data
    medico_id = informe.get("medico_id")

    # Verificar que sea propio o tenga acceso
    if medico_id != current_user["id"]:
        if not _get_acceso(current_user["id"], medico_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    return _flatten_informe(informe)


@router.put("/{informe_id}", response_model=InformeOut)
def actualizar_informe(
    request: Request,
    background_tasks: BackgroundTasks,
    informe_id: str,
    body: InformeUpdate,
    current_user: dict = Depends(_medico),
) -> InformeOut:
    """Actualiza un informe en borrador (propio o con acceso de edición)."""
    client = get_supabase_for_user(current_user["token"])

    # Intentar cargar el informe; si no es propio, verificar acceso de edición
    try:
        informe = get_informe_or_404(client, informe_id, current_user["id"])
    except HTTPException:
        # Cargar el informe sin restricción de medico_id para verificar acceso
        raw = client.table("informes").select("*").eq("id", informe_id).execute()
        if not raw.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")
        informe = raw.data[0]
        acceso = _get_acceso(current_user["id"], informe["medico_id"])
        if not acceso or not acceso.get("puede_editar"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso para editar este informe")


    changes = body.model_dump(exclude_none=True, mode="json")
    if not changes:
        return informe

    try:
        result = (
            client.table("informes")
            .update(changes)
            .eq("id", informe_id)
            .execute()
        )
    except Exception as exc:
        logger.error("Error al actualizar informe %s: %s", informe_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el informe",
        )

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.ACTUALIZAR_INFORME,
        tabla_afectada="informes",
        registro_id=informe_id,
        detalle={"campos_modificados": list(changes.keys())},
        ip_address=get_client_ip(request),
    )

    actualizado = result.data[0]

    # Si el informe ya estaba finalizado, subir versión editada a OneDrive
    if informe.get("estado") == "finalizado":
        try:
            pac_row = client.table("pacientes").select("*").eq("id", actualizado["paciente_id"]).single().execute()
            med_row = client.table("profiles").select("nombre, apellido").eq("id", current_user["id"]).single().execute()
            paciente = pac_row.data or {}
            medico   = med_row.data or {}
            pdf_bytes = generar_pdf(informe=actualizado, paciente=paciente, medico=medico)
            background_tasks.add_task(subir_informe_a_onedrive, pdf_bytes, actualizado, paciente, True)
        except Exception as exc:
            logger.warning("No se pudo preparar PDF editado para OneDrive: %s", exc)

    return actualizado


@router.post("/{informe_id}/finalizar", response_model=InformeOut)
def finalizar_informe(
    request: Request,
    background_tasks: BackgroundTasks,
    informe_id: str,
    current_user: dict = Depends(_medico),
) -> InformeOut:
    """Finaliza un informe. Esta acción es irreversible."""
    client = get_supabase_for_user(current_user["token"])
    informe = get_informe_or_404(client, informe_id, current_user["id"])
    assert_borrador(informe)

    try:
        result = (
            client.table("informes")
            .update({"estado": "finalizado"})
            .eq("id", informe_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al finalizar el informe",
        )

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.FINALIZAR_INFORME,
        tabla_afectada="informes",
        registro_id=informe_id,
        ip_address=get_client_ip(request),
    )

    finalizado = result.data[0]

    # Subir PDF a OneDrive en background (no bloquea la respuesta)
    try:
        pac_row = client.table("pacientes").select("*").eq("id", finalizado["paciente_id"]).single().execute()
        med_row = client.table("profiles").select("nombre, apellido").eq("id", current_user["id"]).single().execute()
        paciente = pac_row.data or {}
        medico   = med_row.data or {}
        pdf_bytes = generar_pdf(informe=finalizado, paciente=paciente, medico=medico)
        background_tasks.add_task(subir_pdf_onedrive, pdf_bytes, finalizado, paciente)
    except Exception as exc:
        logger.warning("No se pudo preparar el PDF para OneDrive: %s", exc)

    return finalizado


@router.delete("/{informe_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_informe(
    request: Request,
    informe_id: str,
    current_user: dict = Depends(_medico),
) -> None:
    """Elimina un informe en borrador. Los finalizados son inmutables."""
    client = get_supabase_for_user(current_user["token"])
    get_informe_or_404(client, informe_id, current_user["id"])

    try:
        client.table("informes").delete().eq("id", informe_id).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar el informe",
        )

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.ELIMINAR_INFORME,
        tabla_afectada="informes",
        registro_id=informe_id,
        ip_address=get_client_ip(request),
    )


# ── Rutas de la secretaria ────────────────────────────────────────────────────

@router.get("/finalizados/lista", response_model=list[InformeConPaciente])
def listar_finalizados(
    current_user: dict = Depends(_secretaria),
) -> list[InformeConPaciente]:
    """Retorna todos los informes finalizados para la cola de impresión."""
    client = get_supabase_for_user(current_user["token"])

    result = (
        client.table("informes")
        .select(
            "*, "
            "pacientes(nombre, apellido, dni, fecha_nacimiento), "
            "profiles(nombre, apellido)"
        )
        .eq("estado", "finalizado")
        .order("updated_at", desc=True)
        .execute()
    )

    rows = result.data or []
    return [_flatten_informe(r) for r in rows]


# ── Helper ────────────────────────────────────────────────────────────────────

def _flatten_informe(row: dict) -> dict:
    """Aplana los joins de pacientes y profiles al nivel raíz."""
    paciente = row.pop("pacientes", {}) or {}
    medico   = row.pop("profiles",  {}) or {}
    return {
        **row,
        "paciente_nombre":           paciente.get("nombre"),
        "paciente_apellido":         paciente.get("apellido"),
        "paciente_dni":              paciente.get("dni"),
        "paciente_fecha_nacimiento": paciente.get("fecha_nacimiento"),
        "medico_nombre":             medico.get("nombre"),
        "medico_apellido":           medico.get("apellido"),
    }
