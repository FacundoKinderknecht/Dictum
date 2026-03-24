from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InformeCreate(BaseModel):
    paciente_id: UUID
    tipo_estudio: str = Field(..., min_length=1, max_length=100)
    fecha_estudio: date
    medico_solicitante: str | None = Field(default=None, max_length=150)
    contenido: str | None = None


class InformeUpdate(BaseModel):
    tipo_estudio: str | None = Field(default=None, min_length=1, max_length=100)
    fecha_estudio: date | None = None
    medico_solicitante: str | None = Field(default=None, max_length=150)
    contenido: str | None = None


class InformeOut(BaseModel):
    id: UUID
    paciente_id: UUID
    medico_id: UUID
    tipo_estudio: str
    fecha_estudio: date
    medico_solicitante: str | None
    contenido: str | None
    estado: str
    created_at: datetime
    updated_at: datetime


class InformeConPaciente(InformeOut):
    """Informe con datos del paciente embebidos para visualización."""
    paciente_nombre: str
    paciente_apellido: str
    paciente_dni: str
    paciente_fecha_nacimiento: date | None
    medico_nombre: str
    medico_apellido: str
