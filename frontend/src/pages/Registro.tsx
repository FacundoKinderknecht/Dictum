import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function Registro() {
  const { applySession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", nombre: "", apellido: "" });
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.registro({
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
      });
      applySession(res);
      navigate("/medico/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Ya existe una cuenta con ese email.");
        } else if (err.status === 429) {
          setError("Demasiados intentos. Esperá unos minutos.");
        } else {
          setError(err.message || "Error al crear la cuenta.");
        }
      } else {
        setError("Error de conexión. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-idm rounded-full" />
          <span className="text-idm font-black text-xl tracking-tighter select-none">idm</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-800 mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 mb-6">Instituto de Diagnóstico Médico</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Apellido" value={form.apellido} onChange={set("apellido")} required autoComplete="family-name" />
            <Input label="Nombre" value={form.nombre} onChange={set("nombre")} required autoComplete="given-name" />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
          <Input label="Contraseña" type="password" value={form.password} onChange={set("password")} required autoComplete="new-password" />
          <Input label="Confirmar contraseña" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required autoComplete="new-password" />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full justify-center">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="text-idm font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
