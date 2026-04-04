import { api } from "./client";
import type { LoginResponse } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  logout: () => api.post<void>("/auth/logout"),

  refresh: (refresh_token: string) =>
    api.post<LoginResponse>("/auth/refresh", { refresh_token }),

  cambiarContrasena: (password_actual: string, password_nuevo: string) =>
    api.post<void>("/auth/cambiar-contrasena", { password_actual, password_nuevo }),

  verificarEmail: (email: string) =>
    api.post<{ estado: "pendiente" | "activo" | "no_registrado" }>("/auth/verificar-email", { email }),

  activarCuenta: (data: { email: string; nombre: string; apellido: string; dni: string; password: string }) =>
    api.post<LoginResponse>("/auth/activar-cuenta", data),
};
