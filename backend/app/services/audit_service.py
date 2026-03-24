"""Servicio de auditoría — requerido por Ley 25.326.

Todas las acciones relevantes deben registrarse.
Los fallos de auditoría NO interrumpen la operación principal,
pero sí se loguean como error para revisión.
"""
import logging
from uuid import UUID

from app.dependencies import get_admin_client

logger = logging.getLogger(__name__)

# Acciones válidas — usar estas constantes en lugar de strings libres
LOGIN               = "login"
LOGOUT              = "logout"
CREAR_PACIENTE      = "crear_paciente"
ACTUALIZAR_PACIENTE = "actualizar_paciente"
CREAR_INFORME       = "crear_informe"
ACTUALIZAR_INFORME  = "actualizar_informe"
FINALIZAR_INFORME   = "finalizar_informe"
DESCARGAR_PDF       = "descargar_pdf"
ELIMINAR_INFORME    = "eliminar_informe"
CREAR_USUARIO       = "crear_usuario"
DESACTIVAR_USUARIO  = "desactivar_usuario"
ACTIVAR_USUARIO     = "activar_usuario"


def log_audit(
    usuario_id: str | UUID,
    accion: str,
    tabla_afectada: str,
    registro_id: str | UUID | None = None,
    detalle: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """Inserta un registro en audit_log usando el client de servicio (service_role).

    Los errores se capturan y loguean sin propagar para no afectar la operación principal.
    """
    try:
        client = get_admin_client()
        client.table("audit_log").insert({
            "usuario_id": str(usuario_id),
            "accion": accion,
            "tabla_afectada": tabla_afectada,
            "registro_id": str(registro_id) if registro_id else None,
            "detalle": detalle or {},
            "ip_address": ip_address,
        }).execute()
    except Exception as exc:
        logger.error(
            "audit_log insert failed | usuario=%s accion=%s error=%s",
            usuario_id,
            accion,
            exc,
        )
