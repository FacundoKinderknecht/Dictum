import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { Paciente, PacienteCreate, PacienteUpdate } from "../../types";

const EMPTY_FORM: PacienteCreate = { nombre: "", apellido: "", dni: "", fecha_nacimiento: "", telefono: "" };

export default function Pacientes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<Paciente | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<PacienteCreate>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<PacienteUpdate & { dni: string }>({ nombre: "", apellido: "", dni: "" });

  useEffect(() => {
    if (searchParams.get("nuevo") === "1") setMostrarFormulario(true);
  }, [searchParams]);

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
  });

  const crearMutation = useMutation({
    mutationFn: pacientesApi.crear,
    onSuccess: () => {
      setMostrarFormulario(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PacienteUpdate }) =>
      pacientesApi.actualizar(id, data),
    onSuccess: () => {
      setEditando(null);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const eliminarMutation = useMutation({
    mutationFn: pacientesApi.eliminar,
    onSuccess: () => {
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload: PacienteCreate = { nombre: form.nombre, apellido: form.apellido, dni: form.dni };
    if (form.fecha_nacimiento) payload.fecha_nacimiento = form.fecha_nacimiento;
    if (form.telefono) payload.telefono = form.telefono;
    crearMutation.mutate(payload);
  }

  function handleEditar(p: Paciente) {
    setEditando(p);
    setEditForm({
      nombre: p.nombre,
      apellido: p.apellido,
      dni: p.dni,
      fecha_nacimiento: p.fecha_nacimiento ?? "",
      telefono: p.telefono ?? "",
    });
    setFormError(null);
    setMostrarFormulario(false);
  }

  function handleActualizar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setFormError(null);
    const data: PacienteUpdate = {};
    if (editForm.nombre !== editando.nombre) data.nombre = editForm.nombre;
    if (editForm.apellido !== editando.apellido) data.apellido = editForm.apellido;
    if (editForm.dni !== editando.dni) data.dni = editForm.dni;
    if (editForm.fecha_nacimiento !== (editando.fecha_nacimiento ?? "")) {
      data.fecha_nacimiento = editForm.fecha_nacimiento || undefined;
    }
    if (editForm.telefono !== (editando.telefono ?? "")) {
      data.telefono = editForm.telefono || undefined;
    }
    if (Object.keys(data).length === 0) { setEditando(null); return; }
    actualizarMutation.mutate({ id: editando.id, data });
  }

  function handleEliminar() {
    if (!editando) return;
    if (!confirm(`¿Eliminar a ${editando.apellido}, ${editando.nombre}? Esta acción no se puede deshacer.`)) return;
    eliminarMutation.mutate(editando.id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Pacientes"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate("/medico/dashboard")}>
              ← Volver
            </Button>
            <Button size="sm" onClick={() => { setMostrarFormulario(true); setEditando(null); }}>
              + Nuevo paciente
            </Button>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* Formulario nuevo paciente */}
        {mostrarFormulario && (
          <form onSubmit={handleCrear} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">Nuevo paciente</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
              <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              <Input label="DNI" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} required pattern="\d+" title="Solo números" />
              <Input label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento ?? ""} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
              <Input label="Teléfono" value={form.telefono ?? ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="col-span-2" />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={crearMutation.isPending}>Crear paciente</Button>
              <Button type="button" variant="ghost" onClick={() => { setMostrarFormulario(false); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {/* Formulario editar paciente */}
        {editando && (
          <form onSubmit={handleActualizar} className="bg-white border border-idm/30 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">Editar paciente</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Apellido" value={editForm.apellido ?? ""} onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })} required />
              <Input label="Nombre" value={editForm.nombre ?? ""} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} required />
              <Input label="DNI" value={editForm.dni ?? ""} onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })} required pattern="\d+" title="Solo números" />
              <Input label="Fecha de nacimiento" type="date" value={editForm.fecha_nacimiento ?? ""} onChange={(e) => setEditForm({ ...editForm, fecha_nacimiento: e.target.value })} />
              <Input label="Teléfono" value={editForm.telefono ?? ""} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} className="col-span-2" />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button type="submit" loading={actualizarMutation.isPending}>Guardar cambios</Button>
                <Button type="button" variant="ghost" onClick={() => { setEditando(null); setFormError(null); }}>Cancelar</Button>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={eliminarMutation.isPending}
                onClick={handleEliminar}
              >
                Eliminar paciente
              </Button>
            </div>
          </form>
        )}

        <Input
          placeholder="Buscar por apellido, nombre o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {isLoading && <LoadingSpinner />}

        <div className="space-y-2">
          {pacientes?.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                <p className="text-sm text-gray-500">
                  DNI {p.dni}
                  {p.fecha_nacimiento && ` · ${new Date(p.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-AR")}`}
                  {p.telefono && ` · ${p.telefono}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEditar(p)}>Editar</Button>
                {/* Pasar el paciente por state para evitar re-fetch */}
                <Button size="sm" variant="secondary" onClick={() => navigate("/medico/nuevo-informe", { state: { paciente: p } })}>
                  Nuevo informe
                </Button>
              </div>
            </div>
          ))}
          {!isLoading && pacientes?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin resultados.</p>
          )}
        </div>
      </main>
    </div>
  );
}
