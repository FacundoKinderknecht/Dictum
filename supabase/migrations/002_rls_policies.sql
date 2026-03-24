-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — todas las tablas
-- ============================================================

-- ── Habilitar RLS ─────────────────────────────────────────
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================

-- Cada usuario puede leer solo su propio perfil
CREATE POLICY profiles_self_select ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Solo el backend con service_role puede insertar/modificar perfiles
-- (no hay política permissive para INSERT/UPDATE/DELETE desde el lado anon)


-- ============================================================
-- PACIENTES
-- ============================================================

-- Médicos activos pueden ver todos los pacientes
CREATE POLICY pacientes_medico_select ON pacientes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'medico'
              AND activo = true
        )
    );

-- Médicos activos pueden crear pacientes (created_by debe ser ellos mismos)
CREATE POLICY pacientes_medico_insert ON pacientes
    FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'medico'
              AND activo = true
        )
    );

-- Nadie puede actualizar ni eliminar pacientes desde el API
-- (operación administrativa solo vía service_role si fuera necesario)


-- ============================================================
-- INFORMES
-- ============================================================

-- Médico puede leer solo sus propios informes (cualquier estado)
CREATE POLICY informes_medico_select ON informes
    FOR SELECT TO authenticated
    USING (
        medico_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'medico'
              AND activo = true
        )
    );

-- Secretaria puede leer todos los informes finalizados
CREATE POLICY informes_secretaria_select ON informes
    FOR SELECT TO authenticated
    USING (
        estado = 'finalizado'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'secretaria'
              AND activo = true
        )
    );

-- Médico puede insertar informes propios
CREATE POLICY informes_medico_insert ON informes
    FOR INSERT TO authenticated
    WITH CHECK (
        medico_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'medico'
              AND activo = true
        )
    );

-- Médico puede actualizar solo sus propios borradores
-- Los informes finalizados son inmutables
CREATE POLICY informes_medico_update ON informes
    FOR UPDATE TO authenticated
    USING (
        medico_id = auth.uid()
        AND estado = 'borrador'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol = 'medico'
              AND activo = true
        )
    );

-- Nadie puede eliminar informes — jamás
CREATE POLICY informes_no_delete ON informes
    FOR DELETE TO authenticated
    USING (false);
