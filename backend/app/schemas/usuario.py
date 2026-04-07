from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UsuarioCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    rol: str = Field(..., pattern=r"^(medico|secretaria)$")


class UsuarioOut(BaseModel):
    id: UUID
    email: str
    nombre: str
    apellido: str
    rol: str
    activo: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int
    rol: str
    nombre: str
    apellido: str


class RefreshRequest(BaseModel):
    refresh_token: str


class CambiarContrasenaRequest(BaseModel):
    password_actual: str = Field(..., min_length=1)
    password_nuevo: str = Field(..., min_length=8, max_length=72)


# ── Invitaciones ──────────────────────────────────────────────────────────────

class AccesoMedicoIn(BaseModel):
    medico_id: UUID
    puede_editar: bool = False


class InvitacionCreate(BaseModel):
    email: EmailStr
    rol: str = Field(..., pattern=r"^(medico|secretaria)$")
    accesos: list[AccesoMedicoIn] = []


class InvitacionOut(BaseModel):
    id: UUID
    email: str
    rol: str
    estado: str
    accesos: list[dict] = []
    created_at: datetime


class MedicoBasico(BaseModel):
    id: UUID
    nombre: str
    apellido: str


# ── Activación de cuenta (primer login) ──────────────────────────────────────

class VerificarEmailRequest(BaseModel):
    email: EmailStr


class VerificarEmailResponse(BaseModel):
    estado: str  # "pendiente" | "activo" | "no_registrado"


class ActivarCuentaRequest(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    dni: str = Field(..., min_length=1, max_length=20)
    password: str = Field(..., min_length=8, max_length=72)


class ActualizarPerfilRequest(BaseModel):
    matricula: str = Field(..., max_length=50)


class AccesoMedicoOut(BaseModel):
    medico_id: UUID
    puede_editar: bool


class ActualizarAccesosRequest(BaseModel):
    accesos: list[AccesoMedicoIn] = []
