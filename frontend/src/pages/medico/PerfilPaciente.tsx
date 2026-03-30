import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInformesDelPaciente } from "../../hooks/useInformes";
import { pacientesApi } from "../../api/pacientes";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { InformeConPaciente } from "../../types";
import { informesApi } from "../../api/informes";
import { useState } from "react";

export default function PerfilPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: paciente, isLoading: loadingPaciente } = useQuery({
    queryKey: ["pacientes", id],
    queryFn: () => pacientesApi.getById(id!),
    enabled: !!id,
  });

  const { data: informes, isLoading: loadingInformes } = useInformesDelPaciente(id ?? "");

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

  const isLoading = loadingPaciente || loadingInformes;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Paciente no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={`${paciente.apellido}, ${paciente.nombre}`}
        subtitle={`DNI ${paciente.dni}`}
        actions={
          <>
            <Link to={`/medico/nuevo-informe?paciente_id=${paciente.id}`}>
              <Button size="sm">+ Nuevo informe</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
          </>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Datos del paciente */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Datos del paciente
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nombre completo</p>
              <p className="font-medium text-gray-900">
                {paciente.apellido}, {paciente.nombre}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">DNI</p>
              <p className="font-medium text-gray-900">{paciente.dni}</p>
            </div>
            {paciente.fecha_nacimiento && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Fecha de nacimiento</p>
                <p className="font-medium text-gray-900">
                  {new Date(paciente.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-AR")}
                </p>
              </div>
            )}
            {paciente.telefono && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                <p className="font-medium text-gray-900">{paciente.telefono}</p>
              </div>
            )}
          </div>
        </div>

        {/* Informes */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Historial de informes ({informes?.length ?? 0})
          </h2>

          {!informes || informes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              No hay informes para este paciente.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Mobile */}
              <div className="divide-y divide-gray-100 sm:hidden">
                {informes.map((inf) => (
                  <div key={inf.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{inf.tipo_estudio}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                        </p>
                        <Link
                          to={`/medico/perfil-medico/${inf.medico_id}`}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Dr/a. {inf.medico_apellido}, {inf.medico_nombre}
                        </Link>
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
                      {inf.medico_id === user?.id && (
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
                    <th className="px-4 py-3 font-medium">Tipo de estudio</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Médico</th>
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
                      <td className="px-4 py-3 text-gray-800 font-medium">{inf.tipo_estudio}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <Link
                          to={`/medico/perfil-medico/${inf.medico_id}`}
                          className="hover:text-blue-600 hover:underline text-xs"
                        >
                          Dr/a. {inf.medico_apellido}, {inf.medico_nombre}
                        </Link>
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
                          {inf.medico_id === user?.id && (
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
        </div>
      </main>
    </div>
  );
}
