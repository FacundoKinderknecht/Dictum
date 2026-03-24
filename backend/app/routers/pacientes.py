import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import get_client_ip, get_supabase_for_user, require_role
from app.schemas.paciente import PacienteCreate, PacienteOut, PacienteUpdate
from app.services import audit_service

logger = logging.getLogger(__name__)

router = APIRouter()

_medico = require_role("medico")


@router.get("", response_model=list[PacienteOut])
def buscar_pacientes(
    q: str | None = Query(default=None, description="Buscar por nombre, apellido o DNI"),
    current_user: dict = Depends(_medico),
) -> list[PacienteOut]:
    """Busca pacientes por nombre/apellido/DNI. Sin filtro retorna todos."""
    client = get_supabase_for_user(current_user["token"])

    query = client.table("pacientes").select("*").order("apellido")

    if q:
        # Búsqueda case-insensitive en apellido, nombre o dni
        query = query.or_(f"apellido.ilike.%{q}%,nombre.ilike.%{q}%,dni.ilike.%{q}%")

    result = query.execute()
    return result.data or []


@router.get("/{paciente_id}", response_model=PacienteOut)
def get_paciente(
    paciente_id: str,
    current_user: dict = Depends(_medico),
) -> PacienteOut:
    """Retorna un paciente por su ID."""
    client = get_supabase_for_user(current_user["token"])

    try:
        result = (
            client.table("pacientes")
            .select("*")
            .eq("id", paciente_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado")

    return result.data


@router.post("", response_model=PacienteOut, status_code=status.HTTP_201_CREATED)
def crear_paciente(
    request: Request,
    body: PacienteCreate,
    current_user: dict = Depends(_medico),
) -> PacienteOut:
    """Crea un nuevo paciente. El DNI debe ser único."""
    client = get_supabase_for_user(current_user["token"])

    # Verifica duplicado de DNI antes de insertar
    existing = (
        client.table("pacientes")
        .select("id")
        .eq("dni", body.dni)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un paciente con ese DNI",
        )

    payload = body.model_dump(exclude_none=True, mode="json")
    payload["created_by"] = current_user["id"]

    try:
        result = client.table("pacientes").insert(payload).execute()
    except Exception as exc:
        logger.error("Error al crear paciente: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el paciente",
        )

    nuevo = result.data[0]

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.CREAR_PACIENTE,
        tabla_afectada="pacientes",
        registro_id=nuevo["id"],
        detalle={"dni": body.dni, "nombre": body.nombre, "apellido": body.apellido},
        ip_address=get_client_ip(request),
    )

    return nuevo


@router.put("/{paciente_id}", response_model=PacienteOut)
def actualizar_paciente(
    request: Request,
    paciente_id: str,
    body: PacienteUpdate,
    current_user: dict = Depends(_medico),
) -> PacienteOut:
    """Actualiza datos de un paciente."""
    client = get_supabase_for_user(current_user["token"])

    changes = body.model_dump(exclude_none=True, mode="json")
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")

    # Si se cambia el DNI, verificar que no exista en otro paciente
    if "dni" in changes:
        existing = client.table("pacientes").select("id").eq("dni", changes["dni"]).neq("id", paciente_id).execute()
        if existing.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe otro paciente con ese DNI")

    try:
        result = client.table("pacientes").update(changes).eq("id", paciente_id).select("*").execute()
    except Exception as exc:
        logger.error("Error al actualizar paciente %s: %s", paciente_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar")

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.ACTUALIZAR_PACIENTE,
        tabla_afectada="pacientes",
        registro_id=paciente_id,
        detalle={"campos_modificados": list(changes.keys())},
        ip_address=get_client_ip(request),
    )

    return result.data[0]


@router.delete("/{paciente_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_paciente(
    request: Request,
    paciente_id: str,
    current_user: dict = Depends(_medico),
) -> None:
    """Elimina un paciente. Falla si tiene informes asociados."""
    client = get_supabase_for_user(current_user["token"])

    try:
        client.table("pacientes").delete().eq("id", paciente_id).execute()
    except Exception as exc:
        logger.error("Error al eliminar paciente %s: %s", paciente_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al eliminar")

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.ELIMINAR_PACIENTE,
        tabla_afectada="pacientes",
        registro_id=paciente_id,
        ip_address=get_client_ip(request),
    )
