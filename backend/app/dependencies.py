import logging
import threading
import time
from collections.abc import Callable

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()


# ── JWKS cache ────────────────────────────────────────────────────────────────
# Supabase usa ECC (P-256) / ES256 en proyectos nuevos.
# Cacheamos las claves públicas para no hacer un request HTTP por cada validación.

_jwks_cache: dict = {}
_jwks_lock        = threading.Lock()
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600  # refrescar cada hora


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at

    with _jwks_lock:
        if time.time() - _jwks_fetched_at < _JWKS_TTL and _jwks_cache:
            return _jwks_cache

        try:
            response = httpx.get(
                f"{settings.supabase_url}/auth/v1/jwks",
                timeout=5.0,
            )
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_fetched_at = time.time()
        except Exception as exc:
            logger.error("No se pudo obtener JWKS de Supabase: %s", exc)
            if _jwks_cache:
                return _jwks_cache  # reutiliza caché si hay uno previo
            raise

    return _jwks_cache


# ── JWT validation ────────────────────────────────────────────────────────────

def _decode_token(token: str) -> str:
    """Valida el JWT (ES256 o HS256 legacy) y retorna el user_id (claim 'sub').

    Supabase actualmente usa:
    - ES256 con clave ECC (P-256) — proyectos con rotación de claves activa
    - HS256 con shared secret    — proyectos legacy / período de transición
    Soportamos ambos.
    """
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    alg = header.get("alg", "HS256")

    try:
        if alg == "ES256":
            kid  = header.get("kid")
            jwks = _get_jwks()
            keys = jwks.get("keys", [])

            # Busca la clave por kid; si no hay match exacto, intenta con la primera
            key = next((k for k in keys if k.get("kid") == kid), None) or (keys[0] if keys else None)
            if key is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

            payload = jwt.decode(
                token,
                key,
                algorithms=["ES256"],
                options={"verify_aud": False},  # Supabase puede omitir 'aud'
            )

        else:
            # Legacy HS256
            if not settings.supabase_jwt_secret:
                logger.error("Token HS256 recibido pero SUPABASE_JWT_SECRET no está configurado")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión expirada")
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("JWT decode failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    return user_id


# ── Supabase client helpers ───────────────────────────────────────────────────

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


# ── Current user dependency ───────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT, carga el perfil desde Supabase y lo retorna.

    Retorna:
        {id, nombre, apellido, rol, token}
    """
    token = credentials.credentials
    user_id = _decode_token(token)

    try:
        client = get_supabase_for_user(token)
        result = (
            client.table("profiles")
            .select("id, nombre, apellido, rol, activo")
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

    return {
        "id": user_id,
        "nombre": profile["nombre"],
        "apellido": profile["apellido"],
        "rol": profile["rol"],
        "token": token,
    }


def require_role(*roles: str) -> Callable:
    """Dependency factory que valida sesión Y rol.

    Uso: Depends(require_role("medico"))  |  Depends(require_role("admin"))
    """
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["rol"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
        return current_user

    return checker


# ── IP helper ─────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
