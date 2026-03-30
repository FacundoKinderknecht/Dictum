import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInformesDelMedico } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import InformesLista from "../../components/InformesLista";

export default function PerfilMedico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: informes, isLoading } = useInformesDelMedico(id ?? "");

  const esPropioMedico = id === user?.id;

  const medicoNombre =
    informes && informes.length > 0
      ? `Dr/a. ${informes[0].medico_apellido}, ${informes[0].medico_nombre}`
      : esPropioMedico && user
      ? `Dr/a. ${user.apellido}, ${user.nombre}`
      : "Médico";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={esPropioMedico ? "Mis informes" : "Perfil médico"}
        subtitle={medicoNombre}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Volver</Button>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <InformesLista
          informes={informes}
          isLoading={isLoading}
          userId={user?.id ?? ""}
          showMedico={false}
          emptyMessage="No hay informes para este médico."
        />
      </main>
    </div>
  );
}
