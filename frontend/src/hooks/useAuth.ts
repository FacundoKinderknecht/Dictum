import { createContext, useContext } from "react";
import type { AuthUser, LoginResponse, UserRole } from "../types";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  applySession: (res: LoginResponse) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function useRequireRole(role: UserRole): AuthUser {
  const { user } = useAuth();
  if (!user || user.rol !== role) {
    throw new Error(`Rol requerido: ${role}`);
  }
  return user;
}
