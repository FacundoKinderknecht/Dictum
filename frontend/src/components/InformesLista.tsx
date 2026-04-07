import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEliminarInforme } from "../hooks/useInformes";
import { informesApi } from "../api/informes";
import Button from "./ui/Button";
import LoadingSpinner from "./ui/LoadingSpinner";
import type { InformeConPaciente } from "../types";

export interface InformesListaProps {
  informes: InformeConPaciente[] | undefined;
  isLoading: boolean;
  userId: string;
  /** Filtro aplicado antes del buscador. Para "Mis Informes": i => i.medico_id === userId */
  preFilter?: (inf: InformeConPaciente) => boolean;
  /** Ocultar columna Médico (útil en PerfilMedico o MisInformes). Default: true */
  showMedico?: boolean;
  emptyMessage?: string;
}

/** Coincidencia parcial de fecha. fechaISO = "YYYY-MM-DD", q = input del usuario */
function matchesFecha(fechaISO: string, q: string): boolean {
  const [year, month, day] = fechaISO.split("-");
  const parts = q.split("/");
  const allDigits = (s: string) => /^\d+$/.test(s);

  if (parts.length === 1) {
    if (!allDigits(q)) return false;
    if (q.length === 4) return year === q;                       // 2026
    const p = q.padStart(2, "0");
    if (day === p) return true;                                  // dd
    if (parseInt(q) <= 12 && month === p) return true;          // mm (ambiguo)
    return false;
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (!allDigits(a) || !allDigits(b)) return false;
    if (b.length === 4) return month === a.padStart(2, "0") && year === b;  // mm/yyyy
    return day === a.padStart(2, "0") && month === b.padStart(2, "0");       // dd/mm
  }
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (!allDigits(d) || !allDigits(m) || !allDigits(y)) return false;
    const yearMatch = y.length === 4 ? year === y : year.endsWith(y);       // dd/mm/yyyy o dd/mm/yy
    return day === d.padStart(2, "0") && month === m.padStart(2, "0") && yearMatch;
  }
  return false;
}

export default function InformesLista({
  informes,
  isLoading,
  userId,
  preFilter,
  showMedico = true,
  emptyMessage = "No hay informes.",
}: InformesListaProps) {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null); // id + "_m" | id + "_i"
  const eliminarMutation = useEliminarInforme();

  const base = useMemo(
    () => (preFilter ? (informes ?? []).filter(preFilter) : (informes ?? [])),
    [informes, preFilter]
  );

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return base;
    const q = busqueda.toLowerCase().trim();
    return base.filter((i) => {
      const texto = `${i.paciente_nombre} ${i.paciente_apellido} ${i.paciente_dni} ${i.tipo_estudio} ${i.medico_nombre} ${i.medico_apellido}`
        .toLowerCase();
      if (texto.includes(q)) return true;
      if (/[\d/]/.test(q) && matchesFecha(i.fecha_estudio, q)) return true;
      return false;
    });
  }, [base, busqueda]);

  async function handleDescargarPDF(inf: InformeConPaciente, membrete: boolean) {
    const key = inf.id + (membrete ? "_m" : "_i");
    setDownloadingId(key);
    try {
      const blob = await informesApi.descargarPdf(inf.id, membrete);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${inf.id.slice(0, 8)}${membrete ? "" : "_imprimir"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleEliminar(inf: InformeConPaciente) {
    if (!confirm(`¿Eliminar el informe borrador de ${inf.paciente_apellido}, ${inf.paciente_nombre}?`)) return;
    eliminarMutation.mutate(inf.id);
  }

  const esPropio = (inf: InformeConPaciente) => inf.medico_id === userId;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por paciente, DNI, médico, tipo de estudio o fecha (ej: 30, 30/3, 3/2026, 2026)..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Sin resultados */}
      {base.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">{emptyMessage}</p>
      )}
      {base.length > 0 && filtrados.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">
          Sin resultados para "{busqueda}".
        </p>
      )}

      {filtrados.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Mobile: cards */}
          <div className="divide-y divide-gray-100 sm:hidden">
            {filtrados.map((inf) => (
              <div key={inf.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/medico/paciente/${inf.paciente_id}`}
                      className="font-medium text-gray-800 text-sm hover:text-blue-600 hover:underline block truncate"
                    >
                      {inf.paciente_apellido}, {inf.paciente_nombre}
                    </Link>
                    <p className="text-xs text-gray-400">DNI {inf.paciente_dni}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{inf.tipo_estudio}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                    </p>
                    {showMedico && !esPropio(inf) && (
                      <Link
                        to={`/medico/perfil-medico/${inf.medico_id}`}
                        className="text-xs text-blue-500 hover:underline mt-0.5 block"
                      >
                        Dr/a. {inf.medico_apellido}, {inf.medico_nombre}
                      </Link>
                    )}
                  </div>
                  <span className={[
                    "flex-shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium",
                    inf.estado === "finalizado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
                  ].join(" ")}>
                    {inf.estado}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-1 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/ver-informe/${inf.id}`)}>
                    Ver
                  </Button>
                  {esPropio(inf) && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>
                      Editar
                    </Button>
                  )}
                  {inf.estado === "finalizado" && (
                    <>
                      <Button variant="ghost" size="sm" loading={downloadingId === inf.id + "_m"} onClick={() => handleDescargarPDF(inf, true)}>PDF</Button>
                      <Button variant="ghost" size="sm" loading={downloadingId === inf.id + "_i"} onClick={() => handleDescargarPDF(inf, false)}>Imprimir</Button>
                    </>
                  )}
                  {esPropio(inf) && inf.estado === "borrador" && (
                    <Button variant="ghost" size="sm" disabled={eliminarMutation.isPending} onClick={() => handleEliminar(inf)} className="text-red-600 hover:bg-red-50">
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabla */}
          <table className="hidden sm:table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Tipo de estudio</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                {showMedico && <th className="px-4 py-3 font-medium">Médico</th>}
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((inf) => (
                <tr key={inf.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/medico/paciente/${inf.paciente_id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">
                      {inf.paciente_apellido}, {inf.paciente_nombre}
                    </Link>
                    <span className="block text-xs text-gray-400 font-normal">DNI {inf.paciente_dni}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inf.tipo_estudio}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(inf.fecha_estudio + "T00:00:00").toLocaleDateString("es-AR")}
                  </td>
                  {showMedico && (
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {esPropio(inf) ? (
                        <span className="text-gray-400">Vos</span>
                      ) : (
                        <Link to={`/medico/perfil-medico/${inf.medico_id}`} className="hover:text-blue-600 hover:underline">
                          Dr/a. {inf.medico_apellido}, {inf.medico_nombre}
                        </Link>
                      )}
                    </td>
                  )}
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
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/ver-informe/${inf.id}`)}>Ver</Button>
                      {esPropio(inf) && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/medico/editar-informe/${inf.id}`)}>Editar</Button>
                      )}
                      {inf.estado === "finalizado" && (
                        <>
                          <Button variant="ghost" size="sm" loading={downloadingId === inf.id + "_m"} onClick={() => handleDescargarPDF(inf, true)}>PDF</Button>
                          <Button variant="ghost" size="sm" loading={downloadingId === inf.id + "_i"} onClick={() => handleDescargarPDF(inf, false)}>Imprimir</Button>
                        </>
                      )}
                      {esPropio(inf) && inf.estado === "borrador" && (
                        <Button variant="ghost" size="sm" disabled={eliminarMutation.isPending} onClick={() => handleEliminar(inf)} className="text-red-600 hover:bg-red-50">
                          Eliminar
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
  );
}
