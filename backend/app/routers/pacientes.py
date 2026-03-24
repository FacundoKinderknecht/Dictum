from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import get_client_ip, get_supabase_for_user, require_role
from app.schemas.paciente import PacienteCreate, PacienteOut
from app.services import audit_service

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

    try:
        result = (
            client.table("pacientes")
            .insert({
                **body.model_dump(exclude_none=True),
                "created_by": current_user["id"],
            })
            .execute()
        )
    except Exception:
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
