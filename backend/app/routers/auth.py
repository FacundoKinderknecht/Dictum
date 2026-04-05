import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies import get_admin_client, get_client_ip, get_current_user, get_supabase_for_user
from app.schemas.usuario import (
    ActualizarPerfilRequest,
    ActivarCuentaRequest,
    CambiarContrasenaRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    VerificarEmailRequest,
    VerificarEmailResponse,
)
from app.services import audit_service, auth_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/verificar-email", response_model=VerificarEmailResponse)
def verificar_email(body: VerificarEmailRequest) -> VerificarEmailResponse:
    """Verifica si un email está pre-registrado y cuál es su estado."""
    email = body.email.lower()
    admin_client = get_admin_client()

    # Buscar en tabla de invitaciones
    try:
        result = admin_client.table("invitaciones").select("estado").eq("email", email).execute()
        if result.data:
            return VerificarEmailResponse(estado=result.data[0]["estado"])
    except Exception as exc:
        logger.error("Error al verificar invitacion: %s", exc)

    # Verificar si ya existe como usuario activo (usuarios creados sin invitación, ej. admin)
    try:
        auth_users = admin_client.auth.admin.list_users()
        if any(u.email and u.email.lower() == email for u in auth_users):
            return VerificarEmailResponse(estado="activo")
    except Exception as exc:
        logger.error("Error al verificar usuario en auth: %s", exc)

    return VerificarEmailResponse(estado="no_registrado")


@router.post("/activar-cuenta", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def activar_cuenta(request: Request, body: ActivarCuentaRequest) -> LoginResponse:
    """Primer login: completa los datos del usuario y activa la cuenta."""
    email = body.email.lower()
    admin_client = get_admin_client()

    # Verificar que la invitación exista y esté pendiente
    try:
        inv_result = admin_client.table("invitaciones").select("*").eq("email", email).eq("estado", "pendiente").execute()
        if not inv_result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email no preregistrado o ya activado")
        invitacion = inv_result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error al cargar invitación: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al verificar el email")

    # Crear usuario en Supabase Auth
    try:
        auth_resp = admin_client.auth.admin.create_user({
            "email": email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as exc:
        logger.error("Error al crear usuario: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear la cuenta")

    new_id = str(auth_resp.user.id)

    # Crear perfil
    try:
        admin_client.table("profiles").insert({
            "id": new_id,
            "nombre": body.nombre,
            "apellido": body.apellido,
            "dni": body.dni,
            "rol": invitacion["rol"],
            "activo": True,
        }).execute()
    except Exception as exc:
        logger.error("Error al crear perfil: %s", exc)
        try:
            admin_client.auth.admin.delete_user(new_id)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear el perfil")

    # Copiar accesos de la invitación a accesos_medico
    accesos = invitacion.get("accesos") or []
    if accesos:
        try:
            rows = [{"usuario_id": new_id, "medico_id": str(a["medico_id"]), "puede_editar": a.get("puede_editar", False)} for a in accesos]
            admin_client.table("accesos_medico").insert(rows).execute()
        except Exception as exc:
            logger.warning("No se pudieron copiar los accesos: %s", exc)

    # Marcar invitación como activa
    try:
        admin_client.table("invitaciones").update({"estado": "activo"}).eq("id", invitacion["id"]).execute()
    except Exception as exc:
        logger.warning("No se pudo marcar invitación como activa: %s", exc)

    # Auto-login
    try:
        session = auth_service.sign_in(email, body.password)
    except Exception as exc:
        logger.error("Error en auto-login post-activacion: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cuenta creada. Iniciá sesión.")

    audit_service.log_audit(
        usuario_id=new_id,
        accion="activar_cuenta",
        tabla_afectada="profiles",
        registro_id=new_id,
        detalle={"email": email, "rol": invitacion["rol"]},
        ip_address=get_client_ip(request),
    )

    return LoginResponse(
        access_token=session["access_token"],
        refresh_token=session.get("refresh_token"),
        expires_in=session["expires_in"],
        rol=invitacion["rol"],
        nombre=body.nombre,
        apellido=body.apellido,
    )


@router.post("/login", response_model=LoginResponse)
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
        refresh_token=session.get("refresh_token"),
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


@router.patch("/perfil", status_code=status.HTTP_204_NO_CONTENT)
def actualizar_perfil(
    body: ActualizarPerfilRequest,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Permite al usuario actualizar su matrícula profesional."""
    admin_client = get_admin_client()
    try:
        admin_client.table("profiles").update({"matricula": body.matricula or None}).eq("id", current_user["id"]).execute()
    except Exception as exc:
        logger.error("Error al actualizar perfil del usuario %s: %s", current_user["id"], exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar el perfil")


@router.post("/cambiar-contrasena", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_contrasena(
    request: Request,
    body: CambiarContrasenaRequest,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Permite al usuario autenticado cambiar su propia contraseña."""
    admin_client = get_admin_client()

    # Obtener email del usuario para verificar la contraseña actual
    try:
        auth_user = admin_client.auth.admin.get_user_by_id(current_user["id"])
        email = auth_user.user.email
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al obtener datos del usuario")

    # Verificar contraseña actual
    try:
        auth_service.sign_in(email, body.password_actual)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="La contraseña actual es incorrecta")

    # Actualizar contraseña
    try:
        admin_client.auth.admin.update_user_by_id(current_user["id"], {"password": body.password_nuevo})
    except Exception as exc:
        logger.error("Error al cambiar contraseña del usuario %s: %s", current_user["id"], exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al actualizar la contraseña")

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion="cambiar_contrasena",
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
            .eq("id", session["user_id"])
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
        refresh_token=session.get("refresh_token"),
        expires_in=session["expires_in"],
        rol=profile["rol"],
        nombre=profile["nombre"],
        apellido=profile["apellido"],
    )
