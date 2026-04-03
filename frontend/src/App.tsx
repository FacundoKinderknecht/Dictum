import { useState, useCallback, useEffect, useRef } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "./hooks/useAuth";
import { authApi } from "./api/auth";
import { setTokenGetter } from "./api/client";
import { setImagenTokenGetter } from "./api/imagenes";
import { router } from "./router";
import type { AuthUser, LoginResponse, UserRole } from "./types";

const SESSION_KEY = "idm_session";

interface StoredSession {
  user: AuthUser;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function getIdFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? "";
  } catch {
    return "";
  }
}

function buildUser(res: LoginResponse): AuthUser {
  return {
    id: getIdFromToken(res.access_token),
    nombre: res.nombre,
    apellido: res.apellido,
    rol: res.rol as UserRole,
    token: res.access_token,
  };
}

function persistSession(user: AuthUser, res: LoginResponse): void {
  if (!res.refresh_token) return;
  const session: StoredSession = {
    user,
    refreshToken: res.refresh_token,
    expiresAt: Date.now() + res.expires_in * 1000,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export default function App() {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true hasta restaurar sesión
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Aplica una respuesta de login/refresh: actualiza estado, sessionStorage y timer
  const applySession = useCallback((res: LoginResponse) => {
    const u = buildUser(res);
    // Inyectar getter ANTES de setUser para evitar race condition con TanStack Query
    setTokenGetter(() => u.token ?? null);
    setImagenTokenGetter(() => u.token ?? null);
    setUser(u);
    persistSession(u, res);

    clearTimeout(timerRef.current);
    const delay = res.expires_in * 1000 - 5 * 60 * 1000; // 5 min antes del vencimiento
    if (res.refresh_token && delay > 0) {
      timerRef.current = setTimeout(async () => {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (!stored) return;
        const { refreshToken } = JSON.parse(stored) as StoredSession;
        try {
          const refreshed = await authApi.refresh(refreshToken);
          applySession(refreshed);
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      }, delay);
    }
  }, []);

  // Restaurar sesión desde sessionStorage al montar
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    try {
      const { user: storedUser, refreshToken, expiresAt } = JSON.parse(stored) as StoredSession;

      if (Date.now() < expiresAt) {
        // Token todavía válido — restaurar directamente
        setTokenGetter(() => storedUser.token ?? null);
        setImagenTokenGetter(() => storedUser.token ?? null);
        setUser(storedUser);
        const delay = expiresAt - Date.now() - 5 * 60 * 1000;
        if (delay > 0) {
          timerRef.current = setTimeout(async () => {
            try {
              const res = await authApi.refresh(refreshToken);
              applySession(res);
            } catch {
              sessionStorage.removeItem(SESSION_KEY);
              setUser(null);
            }
          }, delay);
        }
        setIsLoading(false);
      } else {
        // Token expirado — intentar refresh
        authApi
          .refresh(refreshToken)
          .then(applySession)
          .catch(() => sessionStorage.removeItem(SESSION_KEY))
          .finally(() => setIsLoading(false));
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      setIsLoading(false);
    }

    return () => clearTimeout(timerRef.current);
  }, [applySession]);

  // Inyectar getter de token en el cliente HTTP cada vez que cambia el usuario
  useEffect(() => {
    setTokenGetter(() => user?.token ?? null);
    setImagenTokenGetter(() => user?.token ?? null);
  }, [user]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const res = await authApi.login(email, password);
        applySession(res);
      } finally {
        setIsLoading(false);
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    clearTimeout(timerRef.current);
    try {
      await authApi.logout();
    } catch {
      // limpiamos sesión igualmente
    }
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, isLoading, login, logout, applySession }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
