from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PacienteUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    apellido: str | None = Field(default=None, min_length=1, max_length=100)
    fecha_nacimiento: date | None = None
    telefono: str | None = Field(default=None, max_length=30)


class PacienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str = Field(..., min_length=1, max_length=100)
    dni: str = Field(..., min_length=6, max_length=15, pattern=r"^\d+$")
    fecha_nacimiento: date | None = None
    telefono: str | None = Field(default=None, max_length=30)


class PacienteOut(BaseModel):
    id: UUID
    nombre: str
    apellido: str
    dni: str
    fecha_nacimiento: date | None
    telefono: str | None
    created_at: datetime
