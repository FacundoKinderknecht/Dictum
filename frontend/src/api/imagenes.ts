import type { ImagenInforme } from "../types";

const _rawBase = import.meta.env.VITE_API_URL ?? "";
const API_BASE =
  location.protocol === "https:" && _rawBase.startsWith("http:")
    ? "https:" + _rawBase.slice(5)
    : _rawBase;

// Token getter inyectado desde App.tsx (igual que client.ts)
let _getToken: () => string | null = () => null;
export function setImagenTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

function authHeaders(): HeadersInit {
  const token = _getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const imagenesApi = {
  async listar(informeId: string): Promise<ImagenInforme[]> {
    const res = await fetch(`${API_BASE}/informes/${informeId}/imagenes`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error al listar imágenes");
    return res.json();
  },

  async subir(informeId: string, file: File): Promise<ImagenInforme> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/informes/${informeId}/imagenes`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Error al subir imagen");
    }
    return res.json();
  },

  async eliminar(informeId: string, filename: string): Promise<void> {
    const res = await fetch(`${API_BASE}/informes/${informeId}/imagenes/${filename}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error al eliminar imagen");
  },
};
