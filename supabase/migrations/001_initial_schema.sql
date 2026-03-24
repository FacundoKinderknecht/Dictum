-- ============================================================
-- 001_initial_schema.sql
-- Tablas base del sistema IDM San Salvador
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tipos ─────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'medico', 'secretaria');

-- ── Perfil de usuario (extiende auth.users de Supabase) ───
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    rol         user_role NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pacientes ─────────────────────────────────────────────
CREATE TABLE pacientes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre           TEXT NOT NULL,
    apellido         TEXT NOT NULL,
    dni              TEXT NOT NULL,
    fecha_nacimiento DATE,
    telefono         TEXT,
    created_by       UUID NOT NULL REFERENCES profiles(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pacientes_dni_unique UNIQUE (dni)
);

-- ── Informes ──────────────────────────────────────────────
CREATE TABLE informes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id         UUID NOT NULL REFERENCES pacientes(id),
    medico_id           UUID NOT NULL REFERENCES profiles(id),
    tipo_estudio        TEXT NOT NULL,
    fecha_estudio       DATE NOT NULL,
    medico_solicitante  TEXT,
    -- Campos estructurados por tipo de estudio (ej: higado, vesicula, etc.)
    campos_json         JSONB NOT NULL DEFAULT '{}',
    -- Texto libre del editor Tiptap (HTML sanitizado)
    observaciones       TEXT,
    estado              TEXT NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'finalizado')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER informes_updated_at
    BEFORE UPDATE ON informes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Índices de rendimiento ────────────────────────────────
CREATE INDEX idx_pacientes_dni        ON pacientes (dni);
CREATE INDEX idx_pacientes_apellido   ON pacientes (apellido);
CREATE INDEX idx_informes_medico      ON informes (medico_id);
CREATE INDEX idx_informes_paciente    ON informes (paciente_id);
CREATE INDEX idx_informes_estado      ON informes (estado);
CREATE INDEX idx_informes_fecha       ON informes (fecha_estudio DESC);
