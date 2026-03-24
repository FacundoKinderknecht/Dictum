import { api } from "./client";
import type { Paciente, PacienteCreate } from "../types";

export const pacientesApi = {
  buscar: (q?: string) =>
    api.get<Paciente[]>(`/pacientes${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  getById: (id: string) => api.get<Paciente>(`/pacientes/${id}`),

  crear: (data: PacienteCreate) => api.post<Paciente>("/pacientes", data),
};
