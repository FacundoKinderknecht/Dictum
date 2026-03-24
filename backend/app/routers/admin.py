from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies import get_admin_client, get_client_ip, require_role
from app.schemas.usuario import UsuarioCreate, UsuarioOut
from app.services import audit_service

router = APIRouter()

_admin = require_role("admin")


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(
    current_user: dict = Depends(_admin),
) -> list[UsuarioOut]:
    """Lista todos los usuarios del sistema."""
    client = get_admin_client()
    result = (
        client.table("profiles")
        .select("id, nombre, apellido, rol, activo, created_at")
        .order("apellido")
        .execute()
    )

    # Enriquecer con el email desde auth.users via admin API
    auth_users = client.auth.admin.list_users()
    email_map = {str(u.id): u.email for u in auth_users}

    usuarios = []
    for p in (result.data or []):
        usuarios.append({
            **p,
            "email": email_map.get(p["id"], ""),
        })
    return usuarios


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    request: Request,
    body: UsuarioCreate,
    current_user: dict = Depends(_admin),
) -> UsuarioOut:
    """Crea un nuevo usuario en Supabase Auth y su perfil."""
    client = get_admin_client()

    # Verifica que el email no esté en uso
    existing = client.auth.admin.list_users()
    if any(u.email == body.email for u in existing):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    # Crea el usuario en Supabase Auth
    try:
        auth_response = client.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el usuario",
        )

    new_user_id = str(auth_response.user.id)

    # Crea el perfil
    try:
        profile_result = (
            client.table("profiles")
            .insert({
                "id": new_user_id,
                "nombre": body.nombre,
                "apellido": body.apellido,
                "rol": body.rol,
                "activo": True,
            })
            .execute()
        )
    except Exception:
        # Intenta limpiar el usuario de Auth si falla el perfil
        try:
            client.auth.admin.delete_user(new_user_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el perfil del usuario",
        )

    profile = profile_result.data[0]

    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=audit_service.CREAR_USUARIO,
        tabla_afectada="profiles",
        registro_id=new_user_id,
        detalle={"email": body.email, "rol": body.rol},
        ip_address=get_client_ip(request),
    )

    return {**profile, "email": body.email}


@router.patch("/usuarios/{usuario_id}/desactivar", response_model=UsuarioOut)
def desactivar_usuario(
    request: Request,
    usuario_id: str,
    current_user: dict = Depends(_admin),
) -> UsuarioOut:
    """Desactiva un usuario. No lo elimina."""
    return _cambiar_estado_usuario(request, usuario_id, activo=False, current_user=current_user)


@router.patch("/usuarios/{usuario_id}/activar", response_model=UsuarioOut)
def activar_usuario(
    request: Request,
    usuario_id: str,
    current_user: dict = Depends(_admin),
) -> UsuarioOut:
    """Reactiva un usuario desactivado."""
    return _cambiar_estado_usuario(request, usuario_id, activo=True, current_user=current_user)


def _cambiar_estado_usuario(
    request: Request,
    usuario_id: str,
    activo: bool,
    current_user: dict,
) -> UsuarioOut:
    if usuario_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés modificar tu propio estado",
        )

    client = get_admin_client()

    try:
        result = (
            client.table("profiles")
            .update({"activo": activo})
            .eq("id", usuario_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    profile = result.data[0]

    # Obtener email
    auth_user = client.auth.admin.get_user_by_id(usuario_id)
    email = auth_user.user.email if auth_user.user else ""

    accion = audit_service.ACTIVAR_USUARIO if activo else audit_service.DESACTIVAR_USUARIO
    audit_service.log_audit(
        usuario_id=current_user["id"],
        accion=accion,
        tabla_afectada="profiles",
        registro_id=usuario_id,
        ip_address=get_client_ip(request),
    )

    return {**profile, "email": email}
