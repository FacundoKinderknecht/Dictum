import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response

from app.dependencies import get_admin_client, get_client_ip, get_supabase_for_user, require_role
from app.services import audit_service
from app.services.pdf_service import generar_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{informe_id}/pdf")
def descargar_pdf(
    request: Request,
    informe_id: str,
    membrete: bool = Query(True, description="Incluir membrete del instituto"),
    current_user: dict = Depends(require_role("medico", "secretaria")),
) -> Response:
    """Genera el PDF en memoria y lo sirve como descarga directa.

    - membrete=true  → con logo, nombre del instituto y línea roja (para archivo)
    - membrete=false → sin encabezado (para imprimir en hojas pre-impresas)
    - Secretaria: sin nombre ni matrícula del médico (genérico)
    """
    client = get_supabase_for_user(current_user["token"])

    try:
        result = (
            client.table("informes")
            .select(
                "*, "
                "pacientes(nombre, apellido, dni, fecha_nacimiento, telefono), "
                "profiles(nombre, apellido, matricula)"
            )
            .eq("id", informe_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    row = result.data
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    medico_id_informe = row.get("medico_id")

    if current_user["rol"] == "secretaria":
        if row.get("estado") != "finalizado":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")
        # Verificar que la secretaria tiene acceso al médico del informe
        acceso = get_admin_client().table("accesos_medico").select("usuario_id").eq("usuario_id", current_user["id"]).eq("medico_id", medico_id_informe).execute()
        if not acceso.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este informe")
    else:
        # Médico: debe ser el dueño o tener acceso asignado
        if medico_id_informe != current_user["id"]:
            acceso = get_admin_client().table("accesos_medico").select("usuario_id").eq("usuario_id", current_user["id"]).eq("medico_id", medico_id_informe).execute()
            if not acceso.data:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este informe")

    paciente = row.pop("pacientes", {}) or {}
    medico   = row.pop("profiles",  {}) or {}

    # Secretaria: PDF genérico sin nombre ni matrícula del médico
    if current_user["rol"] == "secretaria":
        medico = {}

    try:
        pdf_bytes = generar_pdf(informe=row, paciente=paciente, medico=medico, con_membrete=membrete)
    except Exception as exc:
        logger.error("PDF generation failed for informe %s: %s", informe_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar el PDF",
        )

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.DESCARGAR_PDF,
        tabla_afectada="informes",
        registro_id=informe_id,
        detalle={"rol": current_user["rol"], "membrete": membrete},
        ip_address=get_client_ip(request),
    )

    suffix = "" if membrete else "_imprimir"
    filename = f"informe_{informe_id[:8]}{suffix}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
