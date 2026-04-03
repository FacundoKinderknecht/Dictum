"""Integración con OneDrive personal via Microsoft Graph API (delegated auth)."""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GRAPH_BASE     = "https://graph.microsoft.com/v1.0"
TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"


def _get_token_from_refresh() -> str | None:
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


def subir_pdf_onedrive(pdf_bytes: bytes, informe: dict, paciente: dict) -> None:
    """Sube el PDF del informe al OneDrive personal. Se llama como tarea en background.

    Estructura en OneDrive:
        Informes IDM/{año}/{mes}/{apellido_paciente}/{tipo}_{id[:8]}.pdf
    """
    token = _get_token_from_refresh()
    if not token:
        return

    try:
        fecha  = str(informe.get("fecha_estudio", "") or "")
        partes = fecha.split("-")
        year   = partes[0] if len(partes) > 0 else "sin-fecha"
        month  = partes[1] if len(partes) > 1 else "00"

        apellido   = (paciente.get("apellido") or "Desconocido").replace("/", "-").replace("\\", "-")
        tipo       = (informe.get("tipo_estudio") or "informe").replace("/", "-").replace("\\", "-")[:40]
        informe_id = str(informe.get("id", ""))[:8]
        filename   = f"{tipo}_{informe_id}.pdf"
        path       = f"Informes IDM/{year}/{month}/{apellido}/{filename}"

        upload_url = f"{GRAPH_BASE}/me/drive/root:/{path}:/content"

        resp = httpx.put(
            upload_url,
            content=pdf_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/pdf",
            },
            timeout=60,
        )

        if resp.is_success:
            logger.info("PDF subido a OneDrive: %s", path)
        else:
            logger.error(
                "OneDrive: upload falló (informe=%s, path=%s): %s — %s",
                informe.get("id"), path, resp.status_code, resp.text,
            )

    except Exception as exc:
        logger.warning("OneDrive: no se pudo subir el PDF (informe=%s): %s", informe.get("id"), exc)
