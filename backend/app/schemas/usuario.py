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


class RegistroRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)


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
