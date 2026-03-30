-- ============================================================
-- 005_rls_medico_read_all.sql
-- Médico puede leer informes de TODOS los médicos (solo lectura)
-- ============================================================

-- Reemplaza la política que solo permitía ver los propios informes.
DROP POLICY IF EXISTS informes_medico_select ON informes;

CREATE POLICY informes_medico_read_all ON informes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND rol IN ('medico', 'secretaria')
              AND activo = true
        )
    );

-- NOTA: Las políticas de INSERT y UPDATE siguen restringidas al médico propietario
-- (medico_id = auth.uid()) — no se modifican.
-- La política informes_secretaria_select queda obsoleta (cubierta por la nueva),
-- pero se mantiene para no romper nada mientras se verifica.
