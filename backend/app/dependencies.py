import base64
import json
import logging
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()


def _get_session_id(token: str) -> str | None:
    try:
        payload_b64 = token.split(".")[1]
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        val = payload.get("session_id") or payload.get("jti")
        return str(val) if val else None
    except Exception:
        return None


# ── Token validation ───────────────────────────────────────────────────────────

def _validate_token(token: str) -> str:
    """Valida el JWT contra Supabase Auth y retorna el user_id (sub).

    Usa client.auth.get_user() — método oficial recomendado por Supabase.
    Funciona con cualquier formato de clave (sb_publishable_ o legacy JWT).
    """
    try:
        client = create_client(settings.supabase_url, settings.supabase_anon_key)
        response = client.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        return response.user.id
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Token validation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


# ── Supabase client helpers ────────────────────────────────────────────────────

def get_supabase_for_user(token: str) -> Client:
    """Client Supabase con el JWT del usuario → RLS activo."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(token)
    return client


def get_admin_client() -> Client:
    """Client con service_role — bypasea RLS.
    Usar EXCLUSIVAMENTE para: crear usuarios (admin) y escribir audit_log.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# ── Current user dependency ────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT con Supabase, carga el perfil y lo retorna.

    Retorna:
        {id, nombre, apellido, rol, token}
    """
    token = credentials.credentials
    user_id = _validate_token(token)

    try:
        client = get_supabase_for_user(token)
        result = (
            client.table("profiles")
            .select("id, nombre, apellido, rol, activo, current_session_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    profile: dict | None = result.data
    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not profile.get("activo"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")

    # Single-session enforcement: si hay un session_id registrado, debe coincidir
    stored_sid = profile.get("current_session_id")
    if stored_sid:
        token_sid = _get_session_id(token)
        if token_sid and token_sid != stored_sid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="sesion_desplazada",
            )

    return {
        "id": user_id,
        "nombre": profile["nombre"],
        "apellido": profile["apellido"],
        "rol": profile["rol"],
        "token": token,
    }


def require_role(*roles: str) -> Callable:
    """Dependency factory que valida sesión Y rol."""
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
        return current_user

    return checker


# ── IP helper ──────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
