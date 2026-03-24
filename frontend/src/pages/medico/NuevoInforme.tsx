import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { informesApi } from "../../api/informes";
import { useCrearInforme } from "../../hooks/useInformes";
import InformeForm from "../../components/InformeForm";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeCreate, InformeUpdate, Paciente } from "../../types";
import { ApiError } from "../../api/client";

export default function NuevoInforme() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get("paciente_id");

  const [busqueda, setBusqueda] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null);
  const [error, setError] = useState<string | null>(null);

  const crearMutation = useCrearInforme();

  const { data: pacientes, isLoading: buscando } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
    enabled: !pacienteIdParam,
  });

  const { data: pacienteDirecto } = useQuery({
    queryKey: ["paciente", pacienteIdParam],
    queryFn: () => pacientesApi.getById(pacienteIdParam!),
    enabled: !!pacienteIdParam,
  });

  useEffect(() => {
    if (pacienteDirecto) setPacienteSeleccionado(pacienteDirecto);
  }, [pacienteDirecto]);

  async function handleGuardar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data as InformeCreate);
      navigate(`/medico/editar-informe/${informe.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data as InformeCreate);
      await informesApi.finalizar(informe.id);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  const isSubmitting = crearMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Nuevo informe"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← Volver
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Selección de paciente */}
        {!pacienteSeleccionado && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="font-medium text-gray-800">Seleccioná un paciente</h2>
            <Input
              placeholder="Buscar por apellido, nombre o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {buscando && <LoadingSpinner text="Buscando..." />}
            <div className="space-y-2">
              {pacientes
                ?.filter(
                  (p) =>
                    !busqueda ||
                    `${p.apellido} ${p.nombre} ${p.dni}`
                      .toLowerCase()
                      .includes(busqueda.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPacienteSeleccionado(p)}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-gray-800">
                      {p.apellido}, {p.nombre}
                    </p>
                    <p className="text-sm text-gray-500">DNI {p.dni}</p>
                  </button>
                ))}
            </div>
            <p className="text-sm text-gray-500">
              ¿No encontrás el paciente?{" "}
              <a href="/medico/pacientes" className="text-idm hover:underline">
                Crear paciente nuevo
              </a>
            </p>
          </div>
        )}

        {/* Formulario */}
        {pacienteSeleccionado && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-medium text-gray-800">Datos del informe</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPacienteSeleccionado(null)}
              >
                Cambiar paciente
              </Button>
            </div>
            <InformeForm
              paciente={pacienteSeleccionado}
              onGuardar={handleGuardar}
              onFinalizar={handleFinalizar}
              onCancel={() => navigate(-1)}
              isSubmitting={isSubmitting}
            />
          </div>
        )}
      </main>
    </div>
  );
}
