import { api } from "./client";
import type { LoginResponse } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  logout: () => api.post<void>("/auth/logout"),

  refresh: (refresh_token: string) =>
    api.post<LoginResponse>("/auth/refresh", { refresh_token }),

  registro: (data: { email: string; password: string; nombre: string; apellido: string }) =>
    api.post<LoginResponse>("/auth/registro", data),
};
