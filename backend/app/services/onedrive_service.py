"""Integración con Microsoft OneDrive via Microsoft Graph API (app-only)."""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"


def _get_token() -> str | None:
    """Obtiene un access token via client credentials (app-only)."""
    if not all([settings.azure_tenant_id, settings.azure_client_id, settings.azure_client_secret]):
        return None
    try:
        resp = httpx.post(
            TOKEN_URL.format(tenant=settings.azure_tenant_id),
            data={
                "grant_type": "client_credentials",
                "client_id": settings.azure_client_id,
                "client_secret": settings.azure_client_secret,
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
    except Exception as exc:
        logger.warning("OneDrive: no se pudo obtener token: %s", exc)
        return None


def subir_pdf_onedrive(pdf_bytes: bytes, informe: dict, paciente: dict) -> None:
    """Sube el PDF del informe a OneDrive. Se llama como tarea en background.

    Estructura en OneDrive:
        Informes IDM/{año}/{mes}/{apellido_paciente}/{tipo}_{id[:8]}.pdf
    """
    if not settings.azure_onedrive_user:
        return

    token = _get_token()
    if not token:
        return

    try:
        # Verificar que el drive existe (e inicializarlo si no)
        drive_url = f"{GRAPH_BASE}/users/{settings.azure_onedrive_user}/drive"
        check = httpx.get(
            drive_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if check.status_code == 404:
            logger.error(
                "OneDrive: el usuario '%s' no tiene OneDrive o falta el permiso "
                "'Files.ReadWrite.All' (Application) con admin consent en Azure. "
                "Status: %s — %s",
                settings.azure_onedrive_user, check.status_code, check.text,
            )
            return
        check.raise_for_status()

        fecha = str(informe.get("fecha_estudio", "") or "")
        partes = fecha.split("-")
        year  = partes[0] if len(partes) > 0 else "sin-fecha"
        month = partes[1] if len(partes) > 1 else "00"

        apellido   = (paciente.get("apellido") or "Desconocido").replace("/", "-").replace("\\", "-")
        tipo       = (informe.get("tipo_estudio") or "informe").replace("/", "-").replace("\\", "-")[:40]
        informe_id = str(informe.get("id", ""))[:8]
        filename   = f"{tipo}_{informe_id}.pdf"
        path       = f"Informes IDM/{year}/{month}/{apellido}/{filename}"

        upload_url = (
            f"{GRAPH_BASE}/users/{settings.azure_onedrive_user}"
            f"/drive/root:/{path}:/content"
        )

        resp = httpx.put(
            upload_url,
            content=pdf_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/pdf",
            },
            timeout=60,
        )
        if not resp.is_success:
            logger.error(
                "OneDrive: upload falló (informe=%s, path=%s): %s — %s",
                informe.get("id"), path, resp.status_code, resp.text,
            )
            return
        logger.info("PDF subido a OneDrive: %s", path)

    except Exception as exc:
        logger.warning("OneDrive: no se pudo subir el PDF (informe=%s): %s", informe.get("id"), exc)
