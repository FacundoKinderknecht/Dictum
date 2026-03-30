import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";

interface CardProps {
  to: string;
  titulo: string;
  descripcion: string;
  badge?: number;
}

function Card({ to, titulo, descripcion, badge }: CardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-idm/30 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-gray-900 group-hover:text-idm transition-colors">
          {titulo}
        </h2>
        {badge !== undefined && badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 leading-relaxed">{descripcion}</p>
      <span className="text-xs font-medium text-idm mt-auto">
        Abrir →
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { data: informes } = useMisInformes();

  const borradores = informes?.filter(
    (i) => i.medico_id === user?.id && i.estado === "borrador"
  ).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="IDM San Salvador"
        subtitle={`Dr/a. ${user?.apellido ?? ""}, ${user?.nombre ?? ""}`}
        actions={
          <Button variant="ghost" size="sm" onClick={logout}>
            Salir
          </Button>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
          ¿Qué querés hacer?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            to="/medico/informes"
            titulo="Informes"
            descripcion="Ver todos los informes del instituto y crear nuevos."
          />
          <Card
            to="/medico/mis-informes"
            titulo="Mis informes"
            descripcion="Solo los informes creados por vos."
            badge={borradores}
          />
          <Card
            to="/medico/pacientes"
            titulo="Pacientes"
            descripcion="Buscar, crear y gestionar pacientes."
          />
        </div>
      </main>
    </div>
  );
}
