import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import {
  useInforme,
  useActualizarInforme,
  useFinalizarInforme,
} from "../../hooks/useInformes";
import InformeForm from "../../components/InformeForm";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeUpdate } from "../../types";
import { ApiError } from "../../api/client";

export default function EditarInforme() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: informe, isLoading: loadingInforme } = useInforme(id ?? "");
  const { data: paciente, isLoading: loadingPaciente } = useQuery({
    queryKey: ["paciente", informe?.paciente_id],
    queryFn: () => pacientesApi.getById(informe!.paciente_id),
    enabled: !!informe?.paciente_id,
  });

  const actualizarMutation = useActualizarInforme(id ?? "");
  const finalizarMutation  = useFinalizarInforme();

  if (loadingInforme || loadingPaciente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!informe || !paciente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Informe no encontrado.</p>
      </div>
    );
  }

  const isReadOnly = informe.estado === "finalizado";
  const isSubmitting = actualizarMutation.isPending || finalizarMutation.isPending;

  async function handleGuardar(data: InformeUpdate) {
    setError(null);
    try {
      await actualizarMutation.mutateAsync(data);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar() {
    setError(null);
    try {
      await finalizarMutation.mutateAsync(id!);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">
            {isReadOnly ? "Ver informe" : "Editar informe"}
          </h1>
          {isReadOnly && (
            <span className="text-xs text-green-600 font-medium">Finalizado — solo lectura</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-6">
            {error}
          </p>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <InformeForm
            paciente={paciente}
            initialValues={{
              tipo_estudio:      informe.tipo_estudio,
              fecha_estudio:     informe.fecha_estudio,
              medico_solicitante: informe.medico_solicitante ?? undefined,
              campos_json:       informe.campos_json,
              observaciones:     informe.observaciones ?? undefined,
            }}
            onSubmit={(data) => handleGuardar(data as InformeUpdate)}
            onCancel={() => navigate(-1)}
            isSubmitting={isSubmitting}
            onFinalizar={isReadOnly ? undefined : handleFinalizar}
            isReadOnly={isReadOnly}
          />
        </div>
      </main>
    </div>
  );
}
