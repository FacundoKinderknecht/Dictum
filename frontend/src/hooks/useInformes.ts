import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { informesApi } from "../api/informes";
import type { InformeCreate, InformeUpdate } from "../types";

export const INFORMES_KEYS = {
  misInformes: ["informes", "mis-informes"] as const,
  finalizados: ["informes", "finalizados"] as const,
  detail: (id: string) => ["informes", id] as const,
};

export function useMisInformes() {
  return useQuery({
    queryKey: INFORMES_KEYS.misInformes,
    queryFn: informesApi.listarMisInformes,
  });
}

export function useInforme(id: string) {
  return useQuery({
    queryKey: INFORMES_KEYS.detail(id),
    queryFn: () => informesApi.getById(id),
    enabled: !!id,
  });
}

export function useInformesFinalizados() {
  return useQuery({
    queryKey: INFORMES_KEYS.finalizados,
    queryFn: informesApi.listarFinalizados,
  });
}

export function useCrearInforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InformeCreate) => informesApi.crear(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: INFORMES_KEYS.misInformes }),
  });
}

export function useActualizarInforme(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InformeUpdate) => informesApi.actualizar(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INFORMES_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: INFORMES_KEYS.misInformes });
    },
  });
}

export function useFinalizarInforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => informesApi.finalizar(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: INFORMES_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: INFORMES_KEYS.misInformes });
    },
  });
}

export function useEliminarInforme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => informesApi.eliminar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INFORMES_KEYS.misInformes }),
  });
}
