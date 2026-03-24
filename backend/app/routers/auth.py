import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import get_client_ip, get_current_user, get_supabase_for_user
from app.schemas.usuario import LoginRequest, LoginResponse, RefreshRequest
from app.services import audit_service, auth_service

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/15minutes")
def login(request: Request, body: LoginRequest) -> LoginResponse:
    """Autentica al usuario y retorna el JWT.

    Rate limit: 5 intentos por IP cada 15 minutos.
    """
    try:
        session = auth_service.sign_in(body.email, body.password)
    except Exception as e:
        logger.error("Error en sign_in: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Carga el perfil para incluir rol y nombre en la respuesta
    try:
        client = get_supabase_for_user(session["access_token"])
        profile_result = (
            client.table("profiles")
            .select("nombre, apellido, rol")
            .eq("id", session["user_id"])
            .single()
            .execute()
        )
        profile = profile_result.data
        if not profile or not profile.get("rol"):
            raise ValueError("Perfil no encontrado")
    except Exception as e:
        logger.error("Error cargando perfil: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    ip = get_client_ip(request)
    audit_service.log_audit(
        usuario_id=session["user_id"],
        accion=audit_service.LOGIN,
        tabla_afectada="auth",
        detalle={"email": body.email},
        ip_address=ip,
    )

    return LoginResponse(
        access_token=session["access_token"],
        expires_in=session["expires_in"],
        rol=profile["rol"],
        nombre=profile["nombre"],
        apellido=profile["apellido"],
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Invalida la sesión activa en Supabase Auth."""
    try:
        auth_service.sign_out(current_user["token"])
    except Exception:
        pass  # Si falla en Supabase, igualmente borramos la sesión en el frontend

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.LOGOUT,
        tabla_afectada="auth",
        ip_address=get_client_ip(request),
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh(body: RefreshRequest) -> LoginResponse:
    """Renueva el access token usando el refresh token."""
    try:
        session = auth_service.refresh_session(body.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    try:
        client = get_supabase_for_user(session["access_token"])
        profile_result = (
            client.table("profiles")
            .select("nombre, apellido, rol")
            .single()
            .execute()
        )
        profile = profile_result.data
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    return LoginResponse(
        access_token=session["access_token"],
        expires_in=session["expires_in"],
        rol=profile["rol"],
        nombre=profile["nombre"],
        apellido=profile["apellido"],
    )
