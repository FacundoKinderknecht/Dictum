import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string } | null>(null);
  const [cambiandoPaciente, setCambiandoPaciente] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Si viene de NuevoInforme, es un borrador recién creado
  const isNew = (location.state as { isNew?: boolean } | null)?.isNew ?? false;

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
  const isSubmitting = actualizarMutation.isPending;

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

  async function handleGuardar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      await actualizarMutation.mutateAsync(data as InformeUpdate);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function handleFinalizar(data: InformeCreate | InformeUpdate) {
    setError(null);
    try {
      await actualizarMutation.mutateAsync(data as InformeUpdate);
      await informesApi.finalizar(id!);
      navigate("/medico/mis-informes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al finalizar");
    }
  }

  // Cancelar: si es nuevo borra el borrador, si es existente solo vuelve
  async function handleCancelar() {
    if (!isNew) {
      navigate("/medico/mis-informes");
      return;
    }
    setCancelando(true);
    try {
      await informesApi.eliminar(id!);
    } catch {
      // Si no se pudo borrar, igual volvemos
    }
    navigate("/medico/nuevo-informe");
  }

  // Cambiar paciente: siempre borra el borrador y vuelve a la selección
  async function handleCambiarPaciente() {
    if (!confirm("¿Cambiar de paciente? Se eliminará este borrador.")) return;
    setCambiandoPaciente(true);
    try {
      await informesApi.eliminar(id!);
    } catch {
      // Si no se pudo borrar, igual navegamos
    }
    navigate("/medico/nuevo-informe");
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

  const estadoBadge = informe.estado === "finalizado"
    ? <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Finalizado</span>
    : <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Borrador</span>;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Editar informe"
        subtitle={`${informe.paciente_apellido}, ${informe.paciente_nombre} — ${informe.tipo_estudio}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {estadoBadge}
            {informe.estado === "borrador" && (
              <Button
                variant="ghost"
                size="sm"
                loading={cambiandoPaciente}
                onClick={handleCambiarPaciente}
              >
                Cambiar paciente
              </Button>
            )}
            <Button variant="ghost" size="sm" loading={cancelando} onClick={handleCancelar}>
              {isNew ? "✕ Cancelar" : "← Volver"}
            </Button>
          </div>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Formulario */}
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
            onFinalizar={informe.estado === "borrador" ? handleFinalizar : undefined}
            showFinalizarButton={informe.estado === "borrador"}
            guardarLabel={informe.estado === "finalizado" ? "Guardar cambios" : "Guardar borrador"}
            onCancel={handleCancelar}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Imágenes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Imágenes</h2>
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
          </div>

          {loadingImagenes && <LoadingSpinner text="Cargando imágenes..." />}

          {!loadingImagenes && (!imagenes || imagenes.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">Sin imágenes adjuntas.</p>
          )}

          {imagenes && imagenes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imagenes.map((img) => (
                <div key={img.path} className="relative group rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
                  <img
                    src={img.url}
                    alt={img.nombre}
                    className="w-full h-32 object-cover"
                    onClick={() => setLightbox({ url: img.url, nombre: img.nombre })}
                  />
                  <button
                    onClick={() => handleEliminar(img.path, img.nombre)}
                    disabled={deletingPath === img.path}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {deletingPath === img.path ? "..." : "Eliminar"}
                  </button>
                  <p className="text-xs text-gray-500 truncate px-2 py-1">{img.nombre}</p>
                </div>
              ))}
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightbox(null)}
            >
              <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
                <img src={lightbox.url} alt={lightbox.nombre} className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain" />
                <button
                  onClick={() => setLightbox(null)}
                  className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-lg hover:bg-gray-100"
                >
                  ×
                </button>
                <p className="text-center text-white/70 text-sm mt-2">{lightbox.nombre}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
