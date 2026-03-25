import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes, useEliminarInforme } from "../../hooks/useInformes";
import { informesApi } from "../../api/informes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeConPaciente } from "../../types";

export default function MedicoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: informes, isLoading, error } = useMisInformes();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const eliminarMutation = useEliminarInforme();

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

  function handleEliminar(informe: InformeConPaciente) {
    if (!confirm(`¿Eliminar el informe borrador de ${informe.paciente_apellido}, ${informe.paciente_nombre}?`)) return;
    eliminarMutation.mutate(informe.id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Mis Informes"
        subtitle={`Dr/a. ${user?.apellido}, ${user?.nombre}`}
        actions={
          <>
            <Link to="/medico/pacientes">
              <Button variant="secondary" size="sm">Pacientes</Button>
            </Link>
            <Link to="/medico/nuevo-informe">
              <Button size="sm">+ Nuevo informe</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
          </>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Mobile: cards */}
            <div className="divide-y divide-gray-100 sm:hidden">
              {informes.map((inf) => (
                <div key={inf.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {inf.paciente_apellido}, {inf.paciente_nombre}
                      </p>
                      <p className="text-xs text-gray-400">DNI {inf.paciente_dni}</p>
                      <p className="text-xs text-gray-600 mt-1">{inf.tipo_estudio}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <span className={[
                      "flex-shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium",
                      inf.estado === "finalizado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
                    ].join(" ")}>
                      {inf.estado}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>
                      Editar
                    </Button>
                    {inf.estado === "finalizado" && (
                      <Button variant="ghost" size="sm" loading={downloadingId === inf.id} onClick={() => handleDescargarPDF(inf)}>
                        PDF
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={eliminarMutation.isPending} onClick={() => handleEliminar(inf)} className="text-red-600 hover:bg-red-50">
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden sm:table w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Tipo de estudio</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
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
                    <td className="px-4 py-3">
                      <span className={[
                        "inline-block px-2 py-0.5 rounded text-xs font-medium",
                        inf.estado === "finalizado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
                      ].join(" ")}>
                        {inf.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>
                          Editar
                        </Button>
                        {inf.estado === "finalizado" && (
                          <Button variant="ghost" size="sm" loading={downloadingId === inf.id} onClick={() => handleDescargarPDF(inf)}>
                            PDF
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" disabled={eliminarMutation.isPending} onClick={() => handleEliminar(inf)} className="text-red-600 hover:bg-red-50">
                          Eliminar
                        </Button>
                      </div>
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
