import { useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInformesDelMedico } from "../../hooks/useInformes";
import { authApi } from "../../api/auth";
import { api, ApiError } from "../../api/client";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import InformesLista from "../../components/InformesLista";

export default function PerfilMedico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: informes, isLoading } = useInformesDelMedico(id ?? "");

  const esPropioMedico = id === user?.id;

  const medicoNombre =
    informes && informes.length > 0
      ? `Dr/a. ${informes[0].medico_apellido}, ${informes[0].medico_nombre}`
      : esPropioMedico && user
      ? `Dr/a. ${user.apellido}, ${user.nombre}`
      : "Médico";

  // ── Matrícula ─────────────────────────────────────────────────────────────
  const [matricula, setMatricula]         = useState("");
  const [matriculaOk, setMatriculaOk]     = useState(false);
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const [matriculaLoading, setMatriculaLoading] = useState(false);

  async function handleGuardarMatricula(e: FormEvent) {
    e.preventDefault();
    setMatriculaError(null);
    setMatriculaOk(false);
    setMatriculaLoading(true);
    try {
      await api.patch<void>("/auth/perfil", { matricula });
      setMatriculaOk(true);
      setTimeout(() => setMatriculaOk(false), 3000);
    } catch {
      setMatriculaError("Error al guardar. Intentá de nuevo.");
    } finally {
      setMatriculaLoading(false);
    }
  }

  // ── Cambio de contraseña ──────────────────────────────────────────────────
  const [mostrarForm, setMostrarForm] = useState(false);
  const [passForm, setPassForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [passError, setPassError] = useState<string | null>(null);
  const [passOk, setPassOk] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  function setPass(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassForm(f => ({ ...f, [field]: e.target.value }));
      setPassError(null);
      setPassOk(false);
    };
  }

  async function handleCambiarContrasena(e: FormEvent) {
    e.preventDefault();
    setPassError(null);
    setPassOk(false);

    if (passForm.nueva !== passForm.confirmar) {
      setPassError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (passForm.nueva.length < 8) {
      setPassError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }

    setPassLoading(true);
    try {
      await authApi.cambiarContrasena(passForm.actual, passForm.nueva);
      setPassOk(true);
      setPassForm({ actual: "", nueva: "", confirmar: "" });
      setTimeout(() => { setMostrarForm(false); setPassOk(false); }, 2000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPassError("La contraseña actual es incorrecta.");
      } else {
        setPassError("Error al cambiar la contraseña. Intentá de nuevo.");
      }
    } finally {
      setPassLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={esPropioMedico ? "Mis informes" : "Perfil médico"}
        subtitle={medicoNombre}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {esPropioMedico && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-800 mb-3">Matrícula profesional</p>
            <form onSubmit={handleGuardarMatricula} className="flex items-end gap-3 max-w-xs">
              <Input
                label=""
                placeholder="Ej: MP7451"
                value={matricula}
                onChange={(e) => { setMatricula(e.target.value); setMatriculaError(null); setMatriculaOk(false); }}
              />
              <Button type="submit" size="sm" loading={matriculaLoading}>Guardar</Button>
            </form>
            {matriculaError && <p className="mt-2 text-sm text-red-600">{matriculaError}</p>}
            {matriculaOk    && <p className="mt-2 text-sm text-green-700">Matrícula actualizada.</p>}
          </div>
        )}

        {esPropioMedico && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Contraseña</p>
                <p className="text-xs text-gray-500">Cambiá tu contraseña de acceso</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setMostrarForm(v => !v); setPassError(null); setPassOk(false); }}
              >
                {mostrarForm ? "Cancelar" : "Cambiar contraseña"}
              </Button>
            </div>

            {mostrarForm && (
              <form onSubmit={handleCambiarContrasena} className="mt-4 space-y-3 max-w-sm">
                <Input
                  label="Contraseña actual"
                  type="password"
                  value={passForm.actual}
                  onChange={setPass("actual")}
                  required
                  autoComplete="current-password"
                />
                <Input
                  label="Contraseña nueva"
                  type="password"
                  value={passForm.nueva}
                  onChange={setPass("nueva")}
                  required
                  autoComplete="new-password"
                />
                <Input
                  label="Confirmar contraseña nueva"
                  type="password"
                  value={passForm.confirmar}
                  onChange={setPass("confirmar")}
                  required
                  autoComplete="new-password"
                />

                {passError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {passError}
                  </p>
                )}
                {passOk && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                    Contraseña actualizada correctamente.
                  </p>
                )}

                <Button type="submit" loading={passLoading} size="sm">
                  Guardar contraseña
                </Button>
              </form>
            )}
          </div>
        )}

        <InformesLista
          informes={informes}
          isLoading={isLoading}
          userId={user?.id ?? ""}
          showMedico={false}
          emptyMessage="No hay informes para este médico."
        />
      </main>
    </div>
  );
}
