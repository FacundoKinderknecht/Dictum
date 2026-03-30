import { useNavigate, useParams } from "react-router-dom";
import { useInforme } from "../../hooks/useInformes";
import { useAuth } from "../../hooks/useAuth";
import { informesApi } from "../../api/informes";
import { useState } from "react";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function VerInforme() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: informe, isLoading } = useInforme(id ?? "");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const esPropio = informe?.medico_id === user?.id;

  async function handleDescargarPDF() {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const blob = await informesApi.descargarPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!informe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Informe no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Ver informe"
        subtitle={informe.estado === "finalizado" ? "Finalizado" : "Borrador"}
        actions={
          <>
            {esPropio && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/medico/editar-informe/${informe.id}`)}>
                Editar
              </Button>
            )}
            {informe.estado === "finalizado" && (
              <Button size="sm" variant="secondary" loading={downloadingPdf} onClick={handleDescargarPDF}>
                Descargar PDF
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Datos del paciente */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Paciente</h2>
          <p className="text-xl font-bold text-gray-900">
            {informe.paciente_apellido}, {informe.paciente_nombre}
          </p>
          <p className="text-base text-gray-500 mt-1">DNI: {informe.paciente_dni}</p>
          {informe.paciente_fecha_nacimiento && (
            <p className="text-base text-gray-500">
              Nacimiento: {new Date(informe.paciente_fecha_nacimiento + "T00:00:00").toLocaleDateString("es-AR")}
            </p>
          )}
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
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Médico informante</p>
              <p className="text-base font-medium text-gray-900">
                Dr/a. {informe.medico_apellido}, {informe.medico_nombre}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        {informe.contenido && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informe</h2>
            <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{informe.contenido}</p>
          </div>
        )}
      </main>
    </div>
  );
}
