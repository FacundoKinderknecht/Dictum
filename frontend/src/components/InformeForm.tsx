import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { InformeCreate, InformeUpdate, Paciente, CampoEstudio } from "../types";
import { TIPOS_ESTUDIO, TIPOS_ESTUDIO_KEYS } from "../types";
import Button from "./ui/Button";
import Input from "./ui/Input";

interface Props {
  paciente: Paciente;
  initialValues?: Partial<InformeCreate>;
  onSubmit: (data: InformeCreate | InformeUpdate) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  onFinalizar?: () => void;
  isReadOnly?: boolean;
}

export default function InformeForm({
  paciente,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  onFinalizar,
  isReadOnly = false,
}: Props) {
  const [tipoEstudio, setTipoEstudio] = useState(
    initialValues?.tipo_estudio ?? TIPOS_ESTUDIO_KEYS[0],
  );
  const [fechaEstudio, setFechaEstudio] = useState(
    initialValues?.fecha_estudio ?? new Date().toISOString().slice(0, 10),
  );
  const [medicoSolicitante, setMedicoSolicitante] = useState(
    initialValues?.medico_solicitante ?? "",
  );
  const [campos, setCampos] = useState<Record<string, string>>(
    initialValues?.campos_json ?? {},
  );

  const campos_config: CampoEstudio[] = TIPOS_ESTUDIO[tipoEstudio] ?? [];

  // Reset campos when tipo changes
  useEffect(() => {
    if (!initialValues?.campos_json) {
      setCampos({});
    }
  }, [tipoEstudio, initialValues?.campos_json]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Observaciones adicionales (opcional)..." }),
    ],
    content: initialValues?.observaciones ?? "",
    editable: !isReadOnly,
  });

  function handleCampoChange(key: string, value: string) {
    setCampos((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      paciente_id: paciente.id,
      tipo_estudio: tipoEstudio,
      fecha_estudio: fechaEstudio,
      medico_solicitante: medicoSolicitante || undefined,
      campos_json: campos,
      observaciones: editor?.getHTML() ?? undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info del paciente (solo lectura) */}
      <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
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
            onChange={(e) => setTipoEstudio(e.target.value)}
            disabled={isReadOnly}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          >
            {TIPOS_ESTUDIO_KEYS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Fecha del estudio"
          type="date"
          value={fechaEstudio}
          onChange={(e) => setFechaEstudio(e.target.value)}
          disabled={isReadOnly}
          required
        />

        <Input
          label="Médico solicitante (opcional)"
          type="text"
          value={medicoSolicitante}
          onChange={(e) => setMedicoSolicitante(e.target.value)}
          disabled={isReadOnly}
          placeholder="Dr/a. Apellido"
          className="sm:col-span-2"
        />
      </div>

      {/* Campos del estudio según tipo */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">
          {tipoEstudio}
        </h3>
        {campos_config.map((campo) => (
          <div key={campo.key} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{campo.label}</label>
            {campo.tipo === "textarea" ? (
              <textarea
                value={campos[campo.key] ?? ""}
                onChange={(e) => handleCampoChange(campo.key, e.target.value)}
                disabled={isReadOnly}
                rows={3}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y disabled:bg-gray-50"
              />
            ) : (
              <input
                type="text"
                value={campos[campo.key] ?? ""}
                onChange={(e) => handleCampoChange(campo.key, e.target.value)}
                disabled={isReadOnly}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
              />
            )}
          </div>
        ))}
      </div>

      {/* Editor Tiptap — observaciones libres */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observaciones</label>
        <div className="border border-gray-300 rounded min-h-[120px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-400">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Acciones */}
      {!isReadOnly && (
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" loading={isSubmitting}>
            Guardar borrador
          </Button>
          {onFinalizar && (
            <Button
              type="button"
              variant="secondary"
              onClick={onFinalizar}
              disabled={isSubmitting}
            >
              Guardar y finalizar
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      )}
    </form>
  );
}
