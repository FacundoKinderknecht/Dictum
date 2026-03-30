import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInformesDelPaciente } from "../../hooks/useInformes";
import { pacientesApi } from "../../api/pacientes";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import InformesLista from "../../components/InformesLista";

export default function PerfilPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: paciente, isLoading: loadingPaciente } = useQuery({
    queryKey: ["pacientes", id],
    queryFn: () => pacientesApi.getById(id!),
    enabled: !!id,
  });

  const { data: informes, isLoading: loadingInformes } = useInformesDelPaciente(id ?? "");

  if (loadingPaciente) {
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Datos del paciente
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nombre completo</p>
              <p className="font-medium text-gray-900">{paciente.apellido}, {paciente.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">DNI</p>
              <p className="font-medium text-gray-900">{paciente.dni}</p>
            </div>
            {paciente.fecha_nacimiento && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Nacimiento</p>
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
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Historial de informes ({informes?.length ?? 0})
          </h2>
          <InformesLista
            informes={informes}
            isLoading={loadingInformes}
            userId={user?.id ?? ""}
            showMedico={true}
            emptyMessage="No hay informes para este paciente."
          />
        </div>
      </main>
    </div>
  );
}
