import { useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { useCrearInforme } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { Paciente } from "../../types";
import { ApiError } from "../../api/client";

export default function NuevoInforme() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pacienteIdParam = searchParams.get("paciente_id");

  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creandoParaId, setCreandoParaId] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Paciente | null>(null);

  // Paciente pre-seleccionado (desde state de navegación)
  const pacienteDesdeState = (location.state as { paciente?: Paciente } | null)?.paciente ?? null;

  const crearMutation = useCrearInforme();

  // Buscar todos los pacientes para la búsqueda manual
  const { data: pacientes, isLoading: buscando } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
    enabled: !pacienteIdParam && !pacienteDesdeState,
  });

  // Obtener datos del paciente cuando viene por URL param
  const { data: pacientePorId, isLoading: cargandoPaciente } = useQuery({
    queryKey: ["paciente", pacienteIdParam],
    queryFn: () => pacientesApi.getById(pacienteIdParam!),
    enabled: !!pacienteIdParam && !pacienteDesdeState,
  });

  // El paciente pre-seleccionado (por state o por URL param)
  const pacientePreseleccionado = pacienteDesdeState ?? pacientePorId ?? null;

  async function crearInforme(paciente: Paciente) {
    setCreandoParaId(paciente.id);
    setError(null);
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const informe = await crearMutation.mutateAsync({
        paciente_id: paciente.id,
        tipo_estudio: "Ecografía Abdominal",
        fecha_estudio: hoy,
      });
      navigate(`/medico/editar-informe/${informe.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear el informe");
      setCreandoParaId(null);
    }
  }

  // ── Vista: paciente pre-seleccionado ────────────────────────────────────────
  if (pacienteIdParam || pacienteDesdeState) {
    if (cargandoPaciente) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader
          title="Nuevo informe"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate("/medico/mis-informes")}>
              ← Cancelar
            </Button>
          }
        />

        <main className="max-w-md mx-auto px-4 sm:px-6 py-10 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {pacientePreseleccionado ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Paciente seleccionado
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {pacientePreseleccionado.apellido}, {pacientePreseleccionado.nombre}
                </p>
                <p className="text-sm text-gray-500">DNI {pacientePreseleccionado.dni}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  loading={!!creandoParaId}
                  onClick={() => crearInforme(pacientePreseleccionado)}
                  className="w-full justify-center"
                >
                  Crear informe para este paciente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/medico/nuevo-informe")}
                  className="w-full justify-center"
                >
                  Elegir otro paciente
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Paciente no encontrado.</p>
          )}
        </main>
      </div>
    );
  }

  // ── Vista: búsqueda manual de paciente ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Nuevo informe"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/medico/mis-informes")}>
            ← Cancelar
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-medium text-gray-800">Seleccioná un paciente</h2>
          <Input
            placeholder="Buscar por apellido, nombre o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {buscando && <LoadingSpinner text="Buscando..." />}
          {/* Confirmación de paciente seleccionado */}
          {seleccionado ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">Paciente seleccionado</p>
                <p className="font-semibold text-gray-900">{seleccionado.apellido}, {seleccionado.nombre}</p>
                <p className="text-sm text-gray-500">DNI {seleccionado.dni}</p>
              </div>
              <div className="flex gap-2">
                <Button loading={!!creandoParaId} onClick={() => crearInforme(seleccionado)}>
                  Crear informe
                </Button>
                <Button variant="ghost" onClick={() => setSeleccionado(null)} disabled={!!creandoParaId}>
                  Cambiar paciente
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pacientes?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSeleccionado(p)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors active:scale-[0.99]"
                >
                  <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                  <p className="text-sm text-gray-500">DNI {p.dni}</p>
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">
            ¿No encontrás el paciente?{" "}
            <Link to="/medico/pacientes?nuevo=1" className="text-blue-600 hover:underline">
              Crear paciente nuevo
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
