import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

/**
 * Verifica sesión activa Y rol antes de renderizar.
 * Sin sesión → /login
 * Rol incorrecto → /login (no filtra información sobre rutas existentes)
 */
export default function ProtectedRoute({ role, children }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-500 text-sm">Cargando...</span>
      </div>
    );
  }

  if (!user || user.rol !== role) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
