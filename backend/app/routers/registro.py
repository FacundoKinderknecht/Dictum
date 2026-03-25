"""Registro público de nuevos médicos."""
import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.dependencies import get_admin_client, get_client_ip
from app.schemas.usuario import LoginResponse, RegistroRequest
from app.services import audit_service, auth_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def registrar_medico(request: Request, body: RegistroRequest) -> LoginResponse:
    """Registro público — crea cuenta con rol médico y retorna sesión activa."""
    client = get_admin_client()

    # Verificar que el email no esté en uso
    try:
        existing_users = client.auth.admin.list_users()
        if any(u.email and u.email.lower() == body.email.lower() for u in existing_users):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una cuenta con ese email",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error verificando email en registro: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al verificar el email")

    # Crear usuario en Supabase Auth
    try:
        auth_resp = client.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as exc:
        logger.error("Error al crear usuario en Auth: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear la cuenta")

    new_id = str(auth_resp.user.id)

    # Crear perfil con rol médico
    try:
        client.table("profiles").insert({
            "id": new_id,
            "nombre": body.nombre,
            "apellido": body.apellido,
            "rol": "medico",
            "activo": True,
        }).execute()
    except Exception as exc:
        logger.error("Error al crear perfil: %s", exc)
        try:
            client.auth.admin.delete_user(new_id)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear el perfil")

    # Auto-login
    try:
        session = auth_service.sign_in(body.email, body.password)
    except Exception as exc:
        logger.error("Error en auto-login post-registro: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_201_CREATED,
            detail="Cuenta creada correctamente. Iniciá sesión.",
        )

    # Registrar session_id
    if session.get("session_id"):
        try:
            client.table("profiles").update(
                {"current_session_id": session["session_id"]}
            ).eq("id", new_id).execute()
        except Exception:
            pass

    audit_service.log_audit(
        usuario_id=new_id,
        accion=audit_service.REGISTRO_USUARIO,
        tabla_afectada="profiles",
        registro_id=new_id,
        detalle={"email": body.email},
        ip_address=get_client_ip(request),
    )

    return LoginResponse(
        access_token=session["access_token"],
        refresh_token=session.get("refresh_token"),
        expires_in=session["expires_in"],
        rol="medico",
        nombre=body.nombre,
        apellido=body.apellido,
    )
