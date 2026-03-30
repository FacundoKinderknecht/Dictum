import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInformesDelMedico } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeConPaciente } from "../../types";
import { informesApi } from "../../api/informes";
import { useState } from "react";

export default function PerfilMedico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: informes, isLoading } = useInformesDelMedico(id ?? "");

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

  // Tomamos nombre del médico del primer informe disponible
  const medicoNombre =
    informes && informes.length > 0
      ? `Dr/a. ${informes[0].medico_apellido}, ${informes[0].medico_nombre}`
      : id === user?.id && user
      ? `Dr/a. ${user.apellido}, ${user.nombre}`
      : "Médico";

  const esPropioMedico = id === user?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={esPropioMedico ? "Mis informes" : "Perfil médico"}
        subtitle={medicoNombre}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Informes ({informes?.length ?? 0})
        </h2>

        {!informes || informes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            No hay informes para este médico.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Mobile */}
            <div className="divide-y divide-gray-100 sm:hidden">
              {informes.map((inf) => (
                <div key={inf.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/medico/paciente/${inf.paciente_id}`}
                        className="font-medium text-gray-800 text-sm truncate hover:text-blue-600 hover:underline block"
                      >
                        {inf.paciente_apellido}, {inf.paciente_nombre}
                      </Link>
                      <p className="text-xs text-gray-400">DNI {inf.paciente_dni}</p>
                      <p className="text-xs text-gray-600 mt-1">{inf.tipo_estudio}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <span
                      className={[
                        "flex-shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium",
                        inf.estado === "finalizado"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700",
                      ].join(" ")}
                    >
                      {inf.estado}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/ver-informe/${inf.id}`)}>
                      Ver
                    </Button>
                    {esPropioMedico && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>
                        Editar
                      </Button>
                    )}
                    {inf.estado === "finalizado" && (
                      <Button variant="ghost" size="sm" loading={downloadingId === inf.id} onClick={() => handleDescargarPDF(inf)}>
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
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
                  <tr
                    key={inf.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <Link
                        to={`/medico/paciente/${inf.paciente_id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {inf.paciente_apellido}, {inf.paciente_nombre}
                      </Link>
                      <span className="block text-xs text-gray-400 font-normal">
                        DNI {inf.paciente_dni}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inf.tipo_estudio}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/ver-informe/${inf.id}`)}>
                          Ver
                        </Button>
                        {esPropioMedico && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>
                            Editar
                          </Button>
                        )}
                        {inf.estado === "finalizado" && (
                          <Button variant="ghost" size="sm" loading={downloadingId === inf.id} onClick={() => handleDescargarPDF(inf)}>
                            PDF
                          </Button>
                        )}
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
