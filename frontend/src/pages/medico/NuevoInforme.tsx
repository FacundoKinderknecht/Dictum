import { useEffect, useRef, useState } from "react";
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

  const pacienteDesdeState = (location.state as { paciente?: Paciente } | null)?.paciente ?? null;

  const crearMutation = useCrearInforme();
  const creacionIniciada = useRef(false);

  const { data: pacientes, isLoading: buscando } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
    enabled: !pacienteIdParam && !pacienteDesdeState,
  });

  const { data: pacienteDirecto } = useQuery({
    queryKey: ["paciente", pacienteIdParam],
    queryFn: () => pacientesApi.getById(pacienteIdParam!),
    enabled: !!pacienteIdParam && !pacienteDesdeState,
  });

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
      // replace:true saca NuevoInforme del historial → el botón "atrás" nunca vuelve acá
      navigate(`/medico/editar-informe/${informe.id}`, {
        replace: true,
        state: { isNew: true },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear el informe");
      setCreandoParaId(null);
    }
  }

  // Auto-crear si viene con paciente en state
  useEffect(() => {
    if (pacienteDesdeState && !creacionIniciada.current) {
      creacionIniciada.current = true;
      crearInforme(pacienteDesdeState);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-crear si viene con paciente_id en URL
  useEffect(() => {
    if (pacienteDirecto && !pacienteDesdeState && !creacionIniciada.current) {
      creacionIniciada.current = true;
      crearInforme(pacienteDirecto);
    }
  }, [pacienteDirecto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spinner mientras se auto-crea desde state o URL param
  if (pacienteDesdeState || pacienteIdParam) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        {error ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
              {error}
            </p>
            <Button variant="ghost" size="sm" onClick={() => navigate("/medico/nuevo-informe")}>
              Volver a buscar
            </Button>
          </div>
        ) : (
          <LoadingSpinner text="Creando informe..." />
        )}
      </div>
    );
  }

  // Búsqueda manual de paciente
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
          <div className="space-y-2">
            {pacientes?.map((p) => (
              <button
                key={p.id}
                onClick={() => crearInforme(p)}
                disabled={!!creandoParaId}
                className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 active:scale-[0.99]"
              >
                {creandoParaId === p.id ? (
                  <p className="text-sm text-gray-500">Creando informe...</p>
                ) : (
                  <>
                    <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                    <p className="text-sm text-gray-500">DNI {p.dni}</p>
                  </>
                )}
              </button>
            ))}
          </div>
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
