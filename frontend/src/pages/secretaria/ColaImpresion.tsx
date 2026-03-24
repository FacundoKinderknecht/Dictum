import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useInformesFinalizados } from "../../hooks/useInformes";
import { informesApi } from "../../api/informes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function ColaImpresion() {
  const { user, logout } = useAuth();
  const { data: informes, isLoading, error } = useInformesFinalizados();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDescargar(informeId: string) {
    setDownloadingId(informeId);
    try {
      const blob = await informesApi.descargarPdf(informeId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${informeId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Cola de impresión"
        subtitle={`${user?.nombre} ${user?.apellido}`}
        actions={
          <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
        }
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && <LoadingSpinner />}

        {error && (
          <p className="text-sm text-red-600">Error al cargar los informes.</p>
        )}

        {!isLoading && !error && informes?.length === 0 && (
          <p className="text-center text-gray-400 py-16">
            No hay informes finalizados pendientes.
          </p>
        )}

        {informes && informes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Tipo de estudio</th>
                  <th className="px-4 py-3 font-medium">Fecha estudio</th>
                  <th className="px-4 py-3 font-medium">Médico</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {informes.map((inf) => (
                  <tr key={inf.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {inf.paciente_apellido}, {inf.paciente_nombre}
                      <span className="block text-xs text-gray-400 font-normal">DNI {inf.paciente_dni}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inf.tipo_estudio}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      Dr/a. {inf.medico_apellido}, {inf.medico_nombre}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={downloadingId === inf.id}
                        onClick={() => handleDescargar(inf.id)}
                      >
                        Descargar PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
