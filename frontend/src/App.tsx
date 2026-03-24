import { useState, useCallback, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "./hooks/useAuth";
import { authApi } from "./api/auth";
import { setTokenGetter } from "./api/client";
import { setImagenTokenGetter } from "./api/imagenes";
import { router } from "./router";
import type { AuthUser, UserRole } from "./types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  // JWT almacenado únicamente en memoria — nunca en localStorage/sessionStorage
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inyecta el getter de token en el cliente HTTP al montar
  useEffect(() => {
    setTokenGetter(() => user?.token ?? null);
    setImagenTokenGetter(() => user?.token ?? null);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);
      const authUser: AuthUser = {
        id:       "",  // No necesitamos el ID en el frontend
        nombre:   response.nombre,
        apellido: response.apellido,
        rol:      response.rol as UserRole,
        token:    response.access_token,
      };
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Igualmente limpiamos la sesión local
    } finally {
      setUser(null);
      queryClient.clear();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, isLoading, login, logout }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
