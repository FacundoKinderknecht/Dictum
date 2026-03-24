import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { pacientesApi } from "../../api/pacientes";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { PacienteCreate } from "../../types";

export default function Pacientes() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<PacienteCreate>({
    nombre: "", apellido: "", dni: "",
    fecha_nacimiento: "", telefono: "",
  });

  const { data: pacientes, isLoading, refetch } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => pacientesApi.buscar(busqueda || undefined),
  });

  const crearMutation = useMutation({
    mutationFn: pacientesApi.crear,
    onSuccess: () => {
      setMostrarFormulario(false);
      setForm({ nombre: "", apellido: "", dni: "", fecha_nacimiento: "", telefono: "" });
      refetch();
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Pacientes"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate("/medico/dashboard")}>
              ← Volver
            </Button>
            <Button size="sm" onClick={() => setMostrarFormulario(true)}>
              + Nuevo paciente
            </Button>
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Input
          placeholder="Buscar por apellido, nombre o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {mostrarFormulario && (
          <form onSubmit={handleCrear} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-medium text-gray-800">Nuevo paciente</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Apellido"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                required
              />
              <Input
                label="Nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
              <Input
                label="DNI"
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                required
                pattern="\d+"
                title="Solo números"
              />
              <Input
                label="Fecha de nacimiento"
                type="date"
                value={form.fecha_nacimiento ?? ""}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
              />
              <Input
                label="Teléfono"
                value={form.telefono ?? ""}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="col-span-2"
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={crearMutation.isPending}>Crear paciente</Button>
              <Button type="button" variant="ghost" onClick={() => setMostrarFormulario(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        {isLoading && <LoadingSpinner />}

        <div className="space-y-2">
          {pacientes?.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-800">{p.apellido}, {p.nombre}</p>
                <p className="text-sm text-gray-500">DNI {p.dni}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/medico/nuevo-informe?paciente_id=${p.id}`)}
              >
                Nuevo informe
              </Button>
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
