import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { informesApi } from "../../api/informes";
import { useCrearInforme } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import InformeForm from "../../components/InformeForm";
import type { Paciente, InformeCreate, InformeUpdate } from "../../types";
import { ApiError } from "../../api/client";

export default function NuevoInforme() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get("paciente_id");

  const [busqueda, setBusqueda] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null);
  const [error, setError] = useState<string | null>(null);

  const crearMutation = useCrearInforme();

  // Si viene con paciente_id en URL, pre-cargar el paciente en state
  const { data: pacienteDirecto, isLoading: loadingPacienteDirecto } = useQuery({
    queryKey: ["paciente", pacienteIdParam],
    queryFn: () => pacientesApi.getById(pacienteIdParam!),
    enabled: !!pacienteIdParam,
  });

  useEffect(() => {
    if (pacienteDirecto && !pacienteSeleccionado) {
      setPacienteSeleccionado(pacienteDirecto);
    }
  }, [pacienteDirecto]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: pacientes, isLoading: buscando } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
    enabled: !pacienteSeleccionado,
  });

  async function handleGuardar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      await crearMutation.mutateAsync(data as InformeCreate);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data as InformeCreate);
      await informesApi.finalizar(informe.id);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  // Spinner mientras carga paciente desde URL param
  if (pacienteIdParam && loadingPacienteDirecto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Cargando paciente..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Nuevo informe"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← Cancelar
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!pacienteSeleccionado ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="font-medium text-gray-800">Seleccioná un paciente</h2>
            <Input
              placeholder="Buscar por apellido, nombre o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {buscando && <LoadingSpinner text="Buscando..." />}
            <div className="space-y-2">
              {pacientes?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPacienteSeleccionado(p)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors active:scale-[0.99]"
                >
                  <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                  <p className="text-sm text-gray-500">DNI {p.dni}</p>
                </button>
              ))}
              {!buscando && pacientes?.length === 0 && busqueda && (
                <p className="text-sm text-gray-400 text-center py-4">Sin resultados.</p>
              )}
            </div>
            <p className="text-sm text-gray-500">
              ¿No encontrás el paciente?{" "}
              <Link to="/medico/pacientes?nuevo=1" className="text-blue-600 hover:underline">
                Crear paciente nuevo
              </Link>
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Datos del informe
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPacienteSeleccionado(null)}
                disabled={crearMutation.isPending}
              >
                Cambiar paciente
              </Button>
            </div>
            <InformeForm
              paciente={pacienteSeleccionado}
              onGuardar={handleGuardar}
              onFinalizar={handleFinalizar}
              onCancel={() => navigate(-1)}
              isSubmitting={crearMutation.isPending}
              guardarLabel="Guardar borrador"
            />
          </div>
        )}
      </main>
    </div>
  );
}
