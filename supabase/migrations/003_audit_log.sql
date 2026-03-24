-- ============================================================
-- 003_audit_log.sql
-- Log de auditoría — requerido por Ley 25.326
-- ============================================================

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES profiles(id),
    accion          TEXT NOT NULL,
    -- Valores posibles: login, logout, crear_paciente, crear_informe,
    -- actualizar_informe, finalizar_informe, descargar_pdf,
    -- crear_usuario, desactivar_usuario, activar_usuario
    tabla_afectada  TEXT NOT NULL,
    registro_id     UUID,
    detalle         JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas de auditoría
CREATE INDEX idx_audit_usuario   ON audit_log (usuario_id);
CREATE INDEX idx_audit_accion    ON audit_log (accion);
CREATE INDEX idx_audit_fecha     ON audit_log (created_at DESC);
CREATE INDEX idx_audit_registro  ON audit_log (registro_id) WHERE registro_id IS NOT NULL;

-- RLS: nadie puede leer/escribir audit_log desde el API público
-- Solo el backend con service_role_key puede hacer INSERT
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política explícita de denegación total para usuarios autenticados
-- (el backend escribe con service_role, que bypasea RLS)
CREATE POLICY audit_log_deny_all ON audit_log
    FOR ALL TO authenticated
    USING (false);
