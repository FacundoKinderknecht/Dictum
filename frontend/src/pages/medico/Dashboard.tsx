import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes } from "../../hooks/useInformes";
import Button from "../../components/ui/Button";

interface CardProps {
  to: string;
  titulo: string;
  descripcion: string;
  badge?: string | number;
  icon: React.ReactNode;
}

function Card({ to, titulo, descripcion, badge, icon }: CardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 text-2xl">
          {icon}
        </div>
        {badge !== undefined && Number(badge) > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
          {titulo}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">{descripcion}</p>
      </div>
      <span className="text-xs font-medium text-blue-500 group-hover:text-blue-700 mt-auto">
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
              IDM San Salvador
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Dr/a. {user?.apellido}, {user?.nombre}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Salir
          </Button>
        </div>
      </header>

      {/* Cards */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
          ¿Qué querés hacer?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            to="/medico/informes"
            titulo="Informes"
            descripcion="Ver todos los informes del instituto y crear nuevos."
            icon="📋"
          />
          <Card
            to="/medico/mis-informes"
            titulo="Mis informes"
            descripcion="Solo los informes creados por vos."
            badge={borradores > 0 ? borradores : undefined}
            icon="👤"
          />
          <Card
            to="/medico/pacientes"
            titulo="Pacientes"
            descripcion="Buscar, crear y gestionar pacientes."
            icon="👥"
          />
        </div>
      </main>
    </div>
  );
}
