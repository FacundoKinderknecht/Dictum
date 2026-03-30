import { api } from "./client";
import type { Informe, InformeConPaciente, InformeCreate, InformeUpdate } from "../types";

export const informesApi = {
  // Médico
  listarMisInformes: () => api.get<InformeConPaciente[]>("/informes/mis-informes"),

  getById: (id: string) => api.get<InformeConPaciente>(`/informes/${id}`),

  crear: (data: InformeCreate) => api.post<Informe>("/informes", data),

  actualizar: (id: string, data: InformeUpdate) =>
    api.put<Informe>(`/informes/${id}`, data),

  finalizar: (id: string) => api.post<Informe>(`/informes/${id}/finalizar`),

  eliminar: (id: string) => api.delete<void>(`/informes/${id}`),

  listarPorPaciente: (pacienteId: string) =>
    api.get<InformeConPaciente[]>(`/pacientes/${pacienteId}/informes`),

  listarPorMedico: (medicoId: string) =>
    api.get<InformeConPaciente[]>(`/informes/por-medico/${medicoId}`),

  // Secretaria
  listarFinalizados: () => api.get<InformeConPaciente[]>("/informes/finalizados/lista"),

  // Compartido (médico + secretaria)
  descargarPdf: (id: string) => api.getBlob(`/informes/${id}/pdf`),
};
