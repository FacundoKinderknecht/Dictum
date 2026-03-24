from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies import get_client_ip, get_supabase_for_user, require_role
from app.schemas.informe import InformeConPaciente, InformeCreate, InformeOut, InformeUpdate
from app.services import audit_service
from app.services.informe_service import assert_borrador, get_informe_or_404

router = APIRouter()

_medico     = require_role("medico")
_secretaria = require_role("secretaria")


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
        .order("created_at", desc=True)
        .execute()
    )

    rows = result.data or []
    return [_flatten_informe(r) for r in rows]


@router.post("/", response_model=InformeOut, status_code=status.HTTP_201_CREATED)
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

    try:
        result = (
            client.table("informes")
            .insert({
                **body.model_dump(exclude_none=False),
                "paciente_id": str(body.paciente_id),
                "medico_id": current_user["id"],
                "estado": "borrador",
            })
            .execute()
        )
    except Exception:
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


@router.get("/{informe_id}", response_model=InformeConPaciente)
def get_informe(
    informe_id: str,
    current_user: dict = Depends(_medico),
) -> InformeConPaciente:
    """Retorna un informe con datos del paciente. Solo propios."""
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

    return _flatten_informe(result.data)


@router.put("/{informe_id}", response_model=InformeOut)
def actualizar_informe(
    request: Request,
    informe_id: str,
    body: InformeUpdate,
    current_user: dict = Depends(_medico),
) -> InformeOut:
    """Actualiza un informe en borrador. Los finalizados son inmutables."""
    client = get_supabase_for_user(current_user["token"])
    informe = get_informe_or_404(client, informe_id, current_user["id"])
    assert_borrador(informe)

    changes = body.model_dump(exclude_none=True)
    if not changes:
        return informe

    try:
        result = (
            client.table("informes")
            .update(changes)
            .eq("id", informe_id)
            .execute()
        )
    except Exception:
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

    return result.data[0]


@router.post("/{informe_id}/finalizar", response_model=InformeOut)
def finalizar_informe(
    request: Request,
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

    return result.data[0]


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
