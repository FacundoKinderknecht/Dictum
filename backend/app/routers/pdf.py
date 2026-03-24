import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response

from app.dependencies import get_client_ip, get_supabase_for_user, require_role
from app.services import audit_service
from app.services.pdf_service import generar_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{informe_id}/pdf")
def descargar_pdf(
    request: Request,
    informe_id: str,
    current_user: dict = Depends(require_role("medico", "secretaria")),
) -> Response:
    """Genera el PDF en memoria y lo sirve como descarga directa.

    El PDF nunca se almacena en disco ni en storage.
    Accesible para médicos (sus propios) y secretaria (solo finalizados).
    """
    client = get_supabase_for_user(current_user["token"])

    # Carga el informe con datos del paciente y médico
    try:
        result = (
            client.table("informes")
            .select(
                "*, "
                "pacientes(nombre, apellido, dni, fecha_nacimiento, telefono), "
                "profiles(nombre, apellido)"
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

    # La secretaria solo puede descargar informes finalizados
    if current_user["rol"] == "secretaria" and row.get("estado") != "finalizado":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado")

    paciente = row.pop("pacientes", {}) or {}
    medico   = row.pop("profiles",  {}) or {}

    try:
        pdf_bytes = generar_pdf(informe=row, paciente=paciente, medico=medico)
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
        detalle={"rol": current_user["rol"]},
        ip_address=get_client_ip(request),
    )

    filename = f"informe_{informe_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
