import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes } from "../../hooks/useInformes";
import { informesApi } from "../../api/informes";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeConPaciente } from "../../types";

export default function MedicoDashboard() {
  const { user, logout } = useAuth();
  const { data: informes, isLoading, error } = useMisInformes();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDescargarPDF(informe: InformeConPaciente) {
    setDownloadingId(informe.id);
    try {
      const blob = await informesApi.descargarPdf(informe.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${informe.id.slice(0, 8)}.pdf`;
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Mis Informes</h1>
          <p className="text-sm text-gray-500">Dr/a. {user?.apellido}, {user?.nombre}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/medico/pacientes">
            <Button variant="secondary" size="sm">Pacientes</Button>
          </Link>
          <Link to="/medico/nuevo-informe">
            <Button size="sm">+ Nuevo informe</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && <LoadingSpinner />}

        {error && (
          <p className="text-sm text-red-600">Error al cargar los informes.</p>
        )}

        {!isLoading && !error && informes?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p>No tenés informes creados.</p>
            <Link to="/medico/nuevo-informe" className="mt-3 inline-block">
              <Button size="sm">Crear primer informe</Button>
            </Link>
          </div>
        )}

        {informes && informes.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Paciente</th>
                <th className="pb-2 pr-4 font-medium">Tipo de estudio</th>
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {informes.map((inf) => (
                <tr key={inf.id} className="border-b border-gray-100 hover:bg-white">
                  <td className="py-3 pr-4 font-medium text-gray-800">
                    {inf.paciente_apellido}, {inf.paciente_nombre}
                    <span className="block text-xs text-gray-400 font-normal">
                      DNI {inf.paciente_dni}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{inf.tipo_estudio}</td>
                  <td className="py-3 pr-4 text-gray-600">
                    {new Date(inf.fecha_estudio).toLocaleDateString("es-AR")}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={[
                        "inline-block px-2 py-0.5 rounded text-xs font-medium",
                        inf.estado === "finalizado"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700",
                      ].join(" ")}
                    >
                      {inf.estado}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {inf.estado === "borrador" && (
                        <Link to={`/medico/editar-informe/${inf.id}`}>
                          <Button variant="ghost" size="sm">Editar</Button>
                        </Link>
                      )}
                      {inf.estado === "finalizado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={downloadingId === inf.id}
                          onClick={() => handleDescargarPDF(inf)}
                        >
                          PDF
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
