import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import AppHeader from "../../components/ui/AppHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import type { AccesoMedicoOut, Invitacion, InvitacionCreate, MedicoBasico, Usuario, UsuarioCreate } from "../../types";

const usuariosApi = {
  listar:          ()                    => api.get<Usuario[]>("/admin/usuarios"),
  crear:           (data: UsuarioCreate) => api.post<Usuario>("/admin/usuarios", data),
  desactivar:      (id: string)          => api.patch<Usuario>(`/admin/usuarios/${id}/desactivar`),
  activar:         (id: string)          => api.patch<Usuario>(`/admin/usuarios/${id}/activar`),
  getAccesos:      (id: string)          => api.get<AccesoMedicoOut[]>(`/admin/usuarios/${id}/accesos`),
  putAccesos:      (id: string, accesos: { medico_id: string; puede_editar: boolean }[]) =>
                     api.put<void>(`/admin/usuarios/${id}/accesos`, { accesos }),
};

const invitacionesApi = {
  listar:  ()                       => api.get<Invitacion[]>("/admin/invitaciones"),
  crear:   (data: InvitacionCreate) => api.post<Invitacion>("/admin/invitaciones", data),
  eliminar:(id: string)             => api.delete<void>(`/admin/invitaciones/${id}`),
};

const medicosApi = {
  listar: () => api.get<MedicoBasico[]>("/admin/medicos"),
};

const EMPTY_USUARIO: UsuarioCreate = {
  email: "", password: "", nombre: "", apellido: "", rol: "medico",
};

type Tab = "usuarios" | "invitaciones";

export default function Usuarios() {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("usuarios");

  // ── Estado usuarios ───────────────────────────────────────────────────────
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState<UsuarioCreate>(EMPTY_USUARIO);
  const [errorUsuario, setErrorUsuario] = useState<string | null>(null);

  const { data: usuarios, isLoading: loadingUsuarios } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: usuariosApi.listar,
  });

  const crearUsuarioMutation = useMutation({
    mutationFn: usuariosApi.crear,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      setMostrarFormUsuario(false);
      setFormUsuario(EMPTY_USUARIO);
      setErrorUsuario(null);
    },
    onError: (err: Error) => setErrorUsuario(err.message),
  });

  const desactivarMutation = useMutation({
    mutationFn: usuariosApi.desactivar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });

  const activarMutation = useMutation({
    mutationFn: usuariosApi.activar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
  });

  // ── Estado edición de permisos ────────────────────────────────────────────
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [editAccesos, setEditAccesos]         = useState<Record<string, boolean>>({});
  const [savingAccesos, setSavingAccesos]     = useState(false);
  const [accesosError, setAccesosError]       = useState<string | null>(null);


  async function abrirEditarPermisos(u: Usuario) {
    setEditandoUsuario(u);
    setAccesosError(null);
    try {
      const accesos = await usuariosApi.getAccesos(u.id);
      const mapa: Record<string, boolean> = {};
      for (const a of accesos) mapa[a.medico_id] = a.puede_editar;
      setEditAccesos(mapa);
    } catch {
      setEditAccesos({});
    }
  }

  function toggleEditAcceso(medicoId: string) {
    setEditAccesos(prev => {
      if (medicoId in prev) { const next = { ...prev }; delete next[medicoId]; return next; }
      return { ...prev, [medicoId]: false };
    });
  }

  function toggleEditEditar(medicoId: string) {
    setEditAccesos(prev => ({ ...prev, [medicoId]: !prev[medicoId] }));
  }

  async function guardarAccesos() {
    if (!editandoUsuario) return;
    setSavingAccesos(true);
    setAccesosError(null);
    try {
      const accesos = Object.entries(editAccesos).map(([medico_id, puede_editar]) => ({ medico_id, puede_editar }));
      await usuariosApi.putAccesos(editandoUsuario.id, accesos);
      setEditandoUsuario(null);
    } catch {
      setAccesosError("Error al guardar. Intentá de nuevo.");
    } finally {
      setSavingAccesos(false);
    }
  }

  // ── Estado invitaciones ───────────────────────────────────────────────────
  const [mostrarFormInv, setMostrarFormInv] = useState(false);
  const [invEmail, setInvEmail]             = useState("");
  const [invRol, setInvRol]                 = useState<"medico" | "secretaria">("medico");
  // accesos: medico_id → puede_editar
  const [invAccesos, setInvAccesos]         = useState<Record<string, boolean>>({});
  const [errorInv, setErrorInv]             = useState<string | null>(null);

  const { data: invitaciones, isLoading: loadingInv } = useQuery({
    queryKey: ["admin", "invitaciones"],
    queryFn: invitacionesApi.listar,
    enabled: tab === "invitaciones",
  });

  const { data: medicos } = useQuery({
    queryKey: ["admin", "medicos"],
    queryFn: medicosApi.listar,
    enabled: mostrarFormInv || !!editandoUsuario,
  });

  const crearInvMutation = useMutation({
    mutationFn: invitacionesApi.crear,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invitaciones"] });
      setMostrarFormInv(false);
      setInvEmail("");
      setInvRol("medico");
      setInvAccesos({});
      setErrorInv(null);
    },
    onError: (err: Error) => setErrorInv(err.message),
  });

  const eliminarInvMutation = useMutation({
    mutationFn: invitacionesApi.eliminar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invitaciones"] }),
  });

  function handleCrearInvitacion(e: React.FormEvent) {
    e.preventDefault();
    setErrorInv(null);
    const accesos = Object.entries(invAccesos).map(([medico_id, puede_editar]) => ({ medico_id, puede_editar }));
    crearInvMutation.mutate({ email: invEmail, rol: invRol, accesos });
  }

  function toggleAcceso(medicoId: string) {
    setInvAccesos(prev => {
      if (medicoId in prev) {
        const next = { ...prev };
        delete next[medicoId];
        return next;
      }
      return { ...prev, [medicoId]: false };
    });
  }

  function toggleEditar(medicoId: string) {
    setInvAccesos(prev => ({ ...prev, [medicoId]: !prev[medicoId] }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Administración"
        actions={
          <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
        }
      />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("usuarios")}
            className={[
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === "usuarios" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            Usuarios activos
          </button>
          <button
            onClick={() => setTab("invitaciones")}
            className={[
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === "invitaciones" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            Invitaciones
          </button>
        </div>

        {/* ── Modal editar permisos ── */}
        {editandoUsuario && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h2 className="font-semibold text-gray-800">
                Permisos — {editandoUsuario.apellido}, {editandoUsuario.nombre}
              </h2>
              <p className="text-xs text-gray-500">Seleccioná los médicos cuyos informes puede ver. Marcá "Puede editar" para permitir edición.</p>

              {!medicos && <p className="text-sm text-gray-400">Cargando médicos...</p>}
              {medicos && medicos.length === 0 && <p className="text-sm text-gray-400">No hay médicos activos.</p>}
              {medicos && medicos.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {medicos.map((m) => {
                    const tieneAcceso = m.id in editAccesos;
                    const puedeEditar = editAccesos[m.id] ?? false;
                    return (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={tieneAcceso} onChange={() => toggleEditAcceso(m.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                          <span className="text-sm text-gray-800">{m.apellido}, {m.nombre}</span>
                        </label>
                        {tieneAcceso && (
                          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-500">
                            <input type="checkbox" checked={puedeEditar} onChange={() => toggleEditEditar(m.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                            Puede editar
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {accesosError && <p className="text-sm text-red-600">{accesosError}</p>}
              <div className="flex gap-3 pt-1">
                <Button onClick={guardarAccesos} loading={savingAccesos}>Guardar</Button>
                <Button variant="ghost" onClick={() => setEditandoUsuario(null)}>Cancelar</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Usuarios ── */}
        {tab === "usuarios" && (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMostrarFormUsuario(true)}>+ Nuevo usuario</Button>
            </div>

            {mostrarFormUsuario && (
              <form
                onSubmit={(e) => { e.preventDefault(); setErrorUsuario(null); crearUsuarioMutation.mutate(formUsuario); }}
                className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-medium text-gray-800">Nuevo usuario</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Apellido" value={formUsuario.apellido} onChange={(e) => setFormUsuario({ ...formUsuario, apellido: e.target.value })} required />
                  <Input label="Nombre"   value={formUsuario.nombre}   onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}   required />
                  <Input label="Email" type="email" value={formUsuario.email} onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })} required className="col-span-2" />
                  <Input label="Contraseña inicial" type="password" value={formUsuario.password} onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })} required minLength={8} />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Rol</label>
                    <select
                      value={formUsuario.rol}
                      onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value as "medico" | "secretaria" })}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="medico">Médico</option>
                      <option value="secretaria">Secretaria</option>
                    </select>
                  </div>
                </div>
                {errorUsuario && <p className="text-sm text-red-600">{errorUsuario}</p>}
                <div className="flex gap-3">
                  <Button type="submit" loading={crearUsuarioMutation.isPending}>Crear usuario</Button>
                  <Button type="button" variant="ghost" onClick={() => setMostrarFormUsuario(false)}>Cancelar</Button>
                </div>
              </form>
            )}

            {loadingUsuarios && <LoadingSpinner />}

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
                        <td className="px-4 py-3 font-medium text-gray-800">{u.apellido}, {u.nombre}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{u.rol}</td>
                        <td className="px-4 py-3">
                          <span className={["inline-block px-2 py-0.5 rounded text-xs font-medium", u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"].join(" ")}>
                            {u.activo ? "activo" : "inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {u.rol !== "admin" && (
                              <Button variant="ghost" size="sm" onClick={() => abrirEditarPermisos(u)}>Permisos</Button>
                            )}
                            {u.activo ? (
                              <Button variant="ghost" size="sm" onClick={() => desactivarMutation.mutate(u.id)} loading={desactivarMutation.isPending}>Desactivar</Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => activarMutation.mutate(u.id)} loading={activarMutation.isPending}>Activar</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Invitaciones ── */}
        {tab === "invitaciones" && (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMostrarFormInv(true)}>+ Nueva invitación</Button>
            </div>

            {mostrarFormInv && (
              <form onSubmit={handleCrearInvitacion} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                <h2 className="font-medium text-gray-800">Nueva invitación</h2>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    required
                    className="col-span-2"
                  />
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">Rol</label>
                    <select
                      value={invRol}
                      onChange={(e) => setInvRol(e.target.value as "medico" | "secretaria")}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="medico">Médico</option>
                      <option value="secretaria">Secretaria</option>
                    </select>
                  </div>
                </div>

                {/* Selector de médicos con permisos */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Acceso a informes de médicos</p>
                  {!medicos && <p className="text-xs text-gray-400">Cargando médicos...</p>}
                  {medicos && medicos.length === 0 && <p className="text-xs text-gray-400">No hay médicos activos.</p>}
                  {medicos && medicos.length > 0 && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {medicos.map((m) => {
                        const tieneAcceso = m.id in invAccesos;
                        const puedeEditar = invAccesos[m.id] ?? false;
                        return (
                          <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tieneAcceso}
                                onChange={() => toggleAcceso(m.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                              />
                              <span className="text-sm text-gray-800">{m.apellido}, {m.nombre}</span>
                            </label>
                            {tieneAcceso && (
                              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={puedeEditar}
                                  onChange={() => toggleEditar(m.id)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                                />
                                Puede editar
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {errorInv && <p className="text-sm text-red-600">{errorInv}</p>}
                <div className="flex gap-3">
                  <Button type="submit" loading={crearInvMutation.isPending}>Guardar invitación</Button>
                  <Button type="button" variant="ghost" onClick={() => { setMostrarFormInv(false); setErrorInv(null); }}>Cancelar</Button>
                </div>
              </form>
            )}

            {loadingInv && <LoadingSpinner />}

            {invitaciones && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {invitaciones.length === 0 && (
                  <p className="px-6 py-8 text-center text-sm text-gray-400">No hay invitaciones todavía.</p>
                )}
                {invitaciones.length > 0 && (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Rol</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                        <th className="px-4 py-3 font-medium">Accesos</th>
                        <th className="px-4 py-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitaciones.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 text-gray-800">{inv.email}</td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{inv.rol}</td>
                          <td className="px-4 py-3">
                            <span className={["inline-block px-2 py-0.5 rounded text-xs font-medium", inv.estado === "pendiente" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"].join(" ")}>
                              {inv.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {inv.accesos.length === 0
                              ? "—"
                              : inv.accesos.map(a => `${a.medico_id.slice(0, 8)}…${a.puede_editar ? " (editar)" : ""}`).join(", ")}
                          </td>
                          <td className="px-4 py-3">
                            {inv.estado === "pendiente" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => eliminarInvMutation.mutate(inv.id)}
                                loading={eliminarInvMutation.isPending}
                              >
                                Eliminar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
