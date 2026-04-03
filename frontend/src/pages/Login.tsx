import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const ROLE_REDIRECT: Record<string, string> = {
  medico:     "/medico/dashboard",
  secretaria: "/secretaria/cola-impresion",
  admin:      "/admin/usuarios",
};

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // Si ya está logueado, redirigir
  if (user) {
    navigate(ROLE_REDIRECT[user.rol] ?? "/login", { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // La redirección la hace AuthProvider vía user change → router reacciona
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429
          ? "Demasiados intentos. Esperá unos minutos."
          : "Email o contraseña incorrectos.");
      } else {
        setError("Error de conexión. Intentá de nuevo.");
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full justify-center">
            Ingresar
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Sos médico y no tenés cuenta?{" "}
          <Link to="/registro" className="text-idm font-medium hover:underline">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
