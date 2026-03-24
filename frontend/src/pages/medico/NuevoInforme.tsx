import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { useCrearInforme, useFinalizarInforme } from "../../hooks/useInformes";
import InformeForm from "../../components/InformeForm";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeCreate, Paciente } from "../../types";
import { ApiError } from "../../api/client";

export default function NuevoInforme() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get("paciente_id");

  const [busqueda, setBusqueda] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [informeId, setInformeId] = useState<string | null>(null);

  const crearMutation = useCrearInforme();
  const finalizarMutation = useFinalizarInforme();

  const { data: pacientes, isLoading: buscando } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
    enabled: !pacienteIdParam && busqueda.length >= 2,
  });

  const { data: pacienteDirecto } = useQuery({
    queryKey: ["paciente", pacienteIdParam],
    queryFn: () => pacientesApi.getById(pacienteIdParam!),
    enabled: !!pacienteIdParam,
  });

  useEffect(() => {
    if (pacienteDirecto) setPacienteSeleccionado(pacienteDirecto);
  }, [pacienteDirecto]);

  async function handleGuardar(data: InformeCreate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data);
      setInformeId(informe.id);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data);
      await finalizarMutation.mutateAsync(informe.id);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  const isSubmitting = crearMutation.isPending || finalizarMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Nuevo informe</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Selección de paciente */}
        {!pacienteSeleccionado && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="font-medium text-gray-800">Seleccioná un paciente</h2>
            <Input
              placeholder="Buscar por apellido, nombre o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {buscando && <LoadingSpinner text="Buscando..." />}
            {pacientes?.map((p) => (
              <button
                key={p.id}
                onClick={() => setPacienteSeleccionado(p)}
                className="w-full text-left px-4 py-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                <p className="text-sm text-gray-500">DNI {p.dni}</p>
              </button>
            ))}
            <p className="text-sm text-gray-500">
              ¿No encontrás el paciente?{" "}
              <a href="/medico/pacientes" className="text-blue-600 hover:underline">
                Crear paciente nuevo
              </a>
            </p>
          </div>
        )}

        {/* Formulario */}
        {pacienteSeleccionado && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
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
              onSubmit={(data) => handleGuardar(data as InformeCreate)}
              onCancel={() => navigate(-1)}
              isSubmitting={isSubmitting}
              onFinalizar={() => {
                // Se obtiene el valor actual del form via submit event
                // La lógica de finalizar se dispara desde el botón "Guardar y finalizar"
                // que llama a onFinalizar pasado como prop y ejecuta handleFinalizar
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
