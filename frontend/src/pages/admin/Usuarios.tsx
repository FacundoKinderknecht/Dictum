import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { Usuario, UsuarioCreate } from "../../types";

const usuariosApi = {
  listar:     ()          => api.get<Usuario[]>("/admin/usuarios"),
  crear:      (data: UsuarioCreate) => api.post<Usuario>("/admin/usuarios", data),
  desactivar: (id: string) => api.patch<Usuario>(`/admin/usuarios/${id}/desactivar`),
  activar:    (id: string) => api.patch<Usuario>(`/admin/usuarios/${id}/activar`),
};

const EMPTY_FORM: UsuarioCreate = {
  email: "", password: "", nombre: "", apellido: "", rol: "medico",
};

export default function Usuarios() {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<UsuarioCreate>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: usuariosApi.listar,
  });

  const crearMutation = useMutation({
    mutationFn: usuariosApi.crear,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      setMostrarForm(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const desactivarMutation = useMutation({
    mutationFn: usuariosApi.desactivar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });

  const activarMutation = useMutation({
    mutationFn: usuariosApi.activar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Gestión de usuarios"
        actions={
          <>
            <Button size="sm" onClick={() => setMostrarForm(true)}>+ Nuevo usuario</Button>
            <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
          </>
        }
      />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {mostrarForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); setFormError(null); crearMutation.mutate(form); }}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-medium text-gray-800">Nuevo usuario</h2>
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
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="col-span-2"
              />
              <Input
                label="Contraseña inicial"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as "medico" | "secretaria" })}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="medico">Médico</option>
                  <option value="secretaria">Secretaria</option>
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={crearMutation.isPending}>Crear usuario</Button>
              <Button type="button" variant="ghost" onClick={() => setMostrarForm(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        {isLoading && <LoadingSpinner />}

        {usuarios && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {u.apellido}, {u.nombre}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{u.rol}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        "inline-block px-2 py-0.5 rounded text-xs font-medium",
                        u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
                      ].join(" ")}>
                        {u.activo ? "activo" : "inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.activo ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => desactivarMutation.mutate(u.id)}
                          loading={desactivarMutation.isPending}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => activarMutation.mutate(u.id)}
                          loading={activarMutation.isPending}
                        >
                          Activar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
