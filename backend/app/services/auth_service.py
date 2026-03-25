"""Lógica de autenticación contra Supabase Auth."""
import base64
import json

from supabase import create_client

from app.config import settings


def _get_session_id(token: str) -> str | None:
    """Extrae el session_id del payload JWT sin verificar firma."""
    try:
        payload_b64 = token.split(".")[1]
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        val = payload.get("session_id") or payload.get("jti")
        return str(val) if val else None
    except Exception:
        return None


def sign_in(email: str, password: str) -> dict:
    """Autentica con Supabase Auth. Retorna la sesión completa.

    Raises:
        Exception con mensaje genérico si las credenciales son inválidas.
    """
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.sign_in_with_password({"email": email, "password": password})

    if not response.session:
        raise ValueError("Credenciales inválidas")

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "expires_in": response.session.expires_in,
        "user_id": str(response.user.id),
        "session_id": _get_session_id(response.session.access_token),
    }


def sign_out(jwt_token: str) -> None:
    """Invalida la sesión en Supabase."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(access_token=jwt_token, refresh_token="")
    client.auth.sign_out()


def refresh_session(refresh_token: str) -> dict:
    """Renueva la sesión con el refresh token. Retorna la nueva sesión."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.refresh_session(refresh_token)

    if not response.session:
        raise ValueError("Refresh token inválido o expirado")

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "expires_in": response.session.expires_in,
        "user_id": str(response.user.id),
        "session_id": _get_session_id(response.session.access_token),
    }
