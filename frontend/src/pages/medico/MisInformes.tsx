import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMisInformes } from "../../hooks/useInformes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import InformesLista from "../../components/InformesLista";
import type { InformeConPaciente } from "../../types";

export default function MisInformes() {
  const { user } = useAuth();
  const { data: informes, isLoading, error } = useMisInformes();

  const soloMios = useCallback(
    (inf: InformeConPaciente) => inf.medico_id === (user?.id ?? ""),
    [user?.id]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Mis informes"
        subtitle={`Dr/a. ${user?.apellido}, ${user?.nombre}`}
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
          preFilter={soloMios}
          showMedico={false}
          emptyMessage="No tenés informes creados."
        />
      </main>
    </div>
  );
}
