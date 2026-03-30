import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import InformesLista from "../../components/InformesLista";

export default function Informes() {
  const { user } = useAuth();
  const { data: informes, isLoading, error } = useMisInformes();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Informes"
        subtitle="Todos los informes del instituto"
        actions={
          <>
            <Link to="/medico/nuevo-informe">
              <Button size="sm">+ Nuevo informe</Button>
            </Link>
            <Link to="/medico/dashboard">
              <Button variant="ghost" size="sm">← Inicio</Button>
            </Link>
          </>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && <p className="text-sm text-red-600 mb-4">Error al cargar los informes.</p>}

        <InformesLista
          informes={informes}
          isLoading={isLoading}
          userId={user?.id ?? ""}
          showMedico={true}
          emptyMessage="No hay informes creados."
        />
      </main>
    </div>
  );
}
