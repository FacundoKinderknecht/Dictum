import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { informesApi } from "../../api/informes";
import { imagenesApi } from "../../api/imagenes";
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const crearMutation = useCrearInforme();

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPendingFiles(informeId: string) {
    for (const file of pendingFiles) {
      await imagenesApi.subir(informeId, file);
    }
  }

  async function handleGuardar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data as InformeCreate);
      if (pendingFiles.length > 0) await uploadPendingFiles(informe.id);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      const informe = await crearMutation.mutateAsync(data as InformeCreate);
      if (pendingFiles.length > 0) await uploadPendingFiles(informe.id);
      await informesApi.finalizar(informe.id);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

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
          <>
            {/* Formulario */}
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

            {/* Imágenes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Imágenes
                </h2>
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={crearMutation.isPending}
                  >
                    Agregar imagen
                  </Button>
                </>
              </div>

              {pendingFiles.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Sin imágenes. Se adjuntarán al guardar.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pendingFiles.map((file, i) => {
                    const url = URL.createObjectURL(file);
                    return (
                      <div
                        key={i}
                        className="relative group rounded-lg overflow-hidden border border-gray-200"
                      >
                        <img
                          src={url}
                          alt={file.name}
                          className="w-full h-32 object-cover"
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <button
                          onClick={() => removeFile(i)}
                          disabled={crearMutation.isPending}
                          className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          Quitar
                        </button>
                        <p className="text-xs text-gray-500 truncate px-2 py-1">{file.name}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
