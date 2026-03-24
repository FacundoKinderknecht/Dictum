import { useState } from "react";
import type { InformeCreate, InformeUpdate, Paciente } from "../types";
import { PROTOCOLOS } from "../data/protocolos";
import Button from "./ui/Button";
import Input from "./ui/Input";

const TIPOS_ESTUDIO_OPTIONS = Object.keys(PROTOCOLOS);

interface Props {
  paciente: Paciente;
  initialValues?: Partial<InformeCreate>;
  onGuardar: (data: InformeCreate | InformeUpdate) => void;
  onFinalizar?: (data: InformeCreate | InformeUpdate) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  showFinalizarButton?: boolean;
  guardarLabel?: string;
}

export default function InformeForm({
  paciente,
  initialValues,
  onGuardar,
  onFinalizar,
  onCancel,
  isSubmitting,
  showFinalizarButton = true,
  guardarLabel = "Guardar borrador",
}: Props) {
  const initialTipo = initialValues?.tipo_estudio ?? "";
  const isKnownTipo = TIPOS_ESTUDIO_OPTIONS.includes(initialTipo);

  const [tipoEstudio, setTipoEstudio] = useState(
    isKnownTipo ? initialTipo : initialTipo ? "Otro" : TIPOS_ESTUDIO_OPTIONS[0],
  );
  const [tipoOtro, setTipoOtro] = useState(!isKnownTipo ? initialTipo : "");
  const [fechaEstudio, setFechaEstudio] = useState(
    initialValues?.fecha_estudio ?? new Date().toISOString().slice(0, 10),
  );
  const [medicoSolicitante, setMedicoSolicitante] = useState(
    initialValues?.medico_solicitante ?? "",
  );
  const [contenido, setContenido] = useState(() => {
    if (initialValues?.contenido) return initialValues.contenido;
    const proto = TIPOS_ESTUDIO_OPTIONS.includes(initialTipo || TIPOS_ESTUDIO_OPTIONS[0])
      ? PROTOCOLOS[initialTipo || TIPOS_ESTUDIO_OPTIONS[0]]
      : "";
    return proto ?? "";
  });

  function handleTipoChange(tipo: string) {
    setTipoEstudio(tipo);
    if (tipo !== "Otro" && PROTOCOLOS[tipo] && !contenido) {
      setContenido(PROTOCOLOS[tipo]);
    }
  }

  function cargarProtocolo() {
    if (tipoEstudio !== "Otro" && PROTOCOLOS[tipoEstudio]) {
      setContenido(PROTOCOLOS[tipoEstudio]);
    }
  }

  function buildData(): InformeCreate | InformeUpdate {
    return {
      paciente_id: paciente.id,
      tipo_estudio: tipoEstudio === "Otro" ? tipoOtro : tipoEstudio,
      fecha_estudio: fechaEstudio,
      medico_solicitante: medicoSolicitante || undefined,
      contenido,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGuardar(buildData());
  }

  function handleFinalizarClick() {
    onFinalizar?.(buildData());
  }

  const hasProtocol = tipoEstudio !== "Otro" && !!PROTOCOLOS[tipoEstudio];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info del paciente */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-gray-800">
          {paciente.apellido}, {paciente.nombre}
        </p>
        <p className="text-gray-500">DNI: {paciente.dni}</p>
      </div>

      {/* Datos del estudio */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Tipo de estudio</label>
          <select
            value={tipoEstudio}
            onChange={(e) => handleTipoChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-idm/30 focus:border-idm"
          >
            {TIPOS_ESTUDIO_OPTIONS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
            <option value="Otro">Otro</option>
          </select>
        </div>

        <Input
          label="Fecha del estudio"
          type="date"
          value={fechaEstudio}
          onChange={(e) => setFechaEstudio(e.target.value)}
          required
        />

        {tipoEstudio === "Otro" && (
          <Input
            label="Especificar tipo de estudio"
            type="text"
            value={tipoOtro}
            onChange={(e) => setTipoOtro(e.target.value)}
            placeholder="Ej: Eco Doppler..."
            required
            className="sm:col-span-2"
          />
        )}

        <Input
          label="Médico solicitante (opcional)"
          type="text"
          value={medicoSolicitante}
          onChange={(e) => setMedicoSolicitante(e.target.value)}
          placeholder="Dr/a. Apellido"
          className="sm:col-span-2"
        />
      </div>

      {/* Contenido del informe */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Contenido del informe</label>
          {hasProtocol && contenido && (
            <button
              type="button"
              onClick={cargarProtocolo}
              className="text-xs text-idm hover:underline"
            >
              Cargar protocolo base
            </button>
          )}
        </div>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={14}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-idm/30 focus:border-idm resize-y font-mono"
          placeholder="Escriba el contenido del informe..."
        />
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" loading={isSubmitting}>
            {guardarLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
        {showFinalizarButton && onFinalizar && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleFinalizarClick}
            disabled={isSubmitting}
          >
            Guardar y finalizar →
          </Button>
        )}
      </div>
    </form>
  );
}
