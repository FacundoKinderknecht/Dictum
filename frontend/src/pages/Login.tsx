import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const ROLE_REDIRECT: Record<string, string> = {
  medico:     "/medico/dashboard",
  secretaria: "/secretaria/cola-impresion",
  admin:      "/admin/usuarios",
};

type Step = "email" | "password" | "activation";

export default function Login() {
  const { login, applySession, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState<Step>("email");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm]         = useState({ nombre: "", apellido: "", dni: "", password: "", confirmar: "" });
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  if (user) {
    navigate(ROLE_REDIRECT[user.rol] ?? "/login", { replace: true });
    return null;
  }

  function setF(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      setError(null);
    };
  }

  // Paso 1: verificar email
  async function handleVerificarEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { estado } = await authApi.verificarEmail(email);
      if (estado === "no_registrado") {
        setError("Este email no está autorizado. Contactá al administrador.");
      } else if (estado === "pendiente") {
        setStep("activation");
      } else {
        setStep("password");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Paso 2a: login normal
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429
          ? "Demasiados intentos. Esperá unos minutos."
          : "Contraseña incorrecta.");
      } else {
        setError("Error de conexión. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Paso 2b: activación (primer login)
  async function handleActivar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.activarCuenta({
        email,
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        password: form.password,
      });
      applySession(res);
      navigate(ROLE_REDIRECT[res.rol] ?? "/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Email no preregistrado o ya activado.");
      } else {
        setError("Error al activar la cuenta. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <img src="/logo_idm.png" alt="IDM" className="h-12 mb-2" />
        <p className="text-sm text-gray-500 mb-6">Instituto de Diagnóstico Médico</p>

        {/* ── Paso 1: email ── */}
        {step === "email" && (
          <form onSubmit={handleVerificarEmail} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
              required
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full justify-center">
              Continuar
            </Button>
          </form>
        )}

        {/* ── Paso 2a: contraseña (usuario ya activado) ── */}
        {step === "password" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2 truncate">{email}</p>
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
              required
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full justify-center">
              Ingresar
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setPassword(""); setError(null); }}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              ← Cambiar email
            </button>
          </form>
        )}

        {/* ── Paso 2b: activación (primer login) ── */}
        {step === "activation" && (
          <form onSubmit={handleActivar} className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
              Primera vez. Completá tus datos para activar la cuenta.
            </div>
            <p className="text-sm text-gray-500 truncate">{email}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Apellido" value={form.apellido} onChange={setF("apellido")} required autoComplete="family-name" autoFocus />
              <Input label="Nombre"   value={form.nombre}   onChange={setF("nombre")}   required autoComplete="given-name" />
            </div>
            <Input label="DNI" value={form.dni} onChange={setF("dni")} required autoComplete="off" />
            <Input label="Contraseña"         type="password" value={form.password}  onChange={setF("password")}  required autoComplete="new-password" />
            <Input label="Confirmar contraseña" type="password" value={form.confirmar} onChange={setF("confirmar")} required autoComplete="new-password" />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full justify-center">
              Activar cuenta
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(null); }}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              ← Cambiar email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
