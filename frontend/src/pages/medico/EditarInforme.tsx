import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import { informesApi } from "../../api/informes";
import { useInforme, useActualizarInforme } from "../../hooks/useInformes";
import { imagenesApi } from "../../api/imagenes";
import InformeForm from "../../components/InformeForm";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeCreate, InformeUpdate } from "../../types";
import { ApiError } from "../../api/client";

export default function EditarInforme() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const { data: informe, isLoading: loadingInforme } = useInforme(id ?? "");
  const { data: paciente, isLoading: loadingPaciente } = useQuery({
    queryKey: ["paciente", informe?.paciente_id],
    queryFn: () => pacientesApi.getById(informe!.paciente_id),
    enabled: !!informe?.paciente_id,
  });

  const { data: imagenes, isLoading: loadingImagenes } = useQuery({
    queryKey: ["imagenes", id],
    queryFn: () => imagenesApi.listar(id!),
    enabled: !!id,
  });

  const actualizarMutation = useActualizarInforme(id ?? "");

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

  const isFinalizado = informe.estado === "finalizado";
  const isSubmitting = actualizarMutation.isPending;

  async function handleGuardar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      await actualizarMutation.mutateAsync(data as InformeUpdate);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      await actualizarMutation.mutateAsync(data as InformeUpdate);
      await informesApi.finalizar(id!);
      navigate("/medico/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      await imagenesApi.subir(id, file);
      qc.invalidateQueries({ queryKey: ["imagenes", id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleEliminar(path: string, filename: string) {
    if (!id) return;
    setDeletingPath(path);
    try {
      await imagenesApi.eliminar(id, filename);
      qc.invalidateQueries({ queryKey: ["imagenes", id] });
    } catch {
      setError("Error al eliminar imagen");
    } finally {
      setDeletingPath(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={isFinalizado ? "Ver informe" : "Editar informe"}
        subtitle={isFinalizado ? "Finalizado" : "Borrador"}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← Volver
          </Button>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Formulario principal */}
        {!isFinalizado && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <InformeForm
              paciente={paciente}
              initialValues={{
                tipo_estudio: informe.tipo_estudio,
                fecha_estudio: informe.fecha_estudio,
                medico_solicitante: informe.medico_solicitante ?? undefined,
                contenido: informe.contenido ?? undefined,
              }}
              onGuardar={handleGuardar}
              onFinalizar={handleFinalizar}
              onCancel={() => navigate(-1)}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {isFinalizado && (
          <>
            {/* Datos del paciente */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Paciente</h2>
              <p className="text-xl font-bold text-gray-900">
                {informe.paciente_apellido}, {informe.paciente_nombre}
              </p>
              <p className="text-base text-gray-500 mt-1">DNI: {informe.paciente_dni}</p>
            </div>

            {/* Datos del estudio */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Estudio</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Tipo</p>
                  <p className="text-base font-medium text-gray-900">{informe.tipo_estudio}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(informe.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                  </p>
                </div>
                {informe.medico_solicitante && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Médico solicitante</p>
                    <p className="text-base font-medium text-gray-900">{informe.medico_solicitante}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contenido */}
            {informe.contenido && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informe</h2>
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-mono">
                  {informe.contenido}
                </p>
              </div>
            )}
          </>
        )}

        {/* Imágenes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Imágenes</h2>
            {!isFinalizado && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Subir imagen
                </Button>
              </>
            )}
          </div>

          {loadingImagenes && <LoadingSpinner text="Cargando imágenes..." />}

          {!loadingImagenes && (!imagenes || imagenes.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">Sin imágenes adjuntas.</p>
          )}

          {imagenes && imagenes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imagenes.map((img) => (
                <div key={img.path} className="relative group rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={img.url}
                    alt={img.nombre}
                    className="w-full h-32 object-cover"
                  />
                  {!isFinalizado && (
                    <button
                      onClick={() => handleEliminar(img.path, img.nombre)}
                      disabled={deletingPath === img.path}
                      className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      {deletingPath === img.path ? "..." : "Eliminar"}
                    </button>
                  )}
                  <p className="text-xs text-gray-500 truncate px-2 py-1">{img.nombre}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
