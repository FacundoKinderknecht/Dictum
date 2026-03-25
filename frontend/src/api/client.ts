/**
 * Cliente HTTP base.
 * - Inyecta el Authorization header automáticamente.
 * - Lanza ApiError con el detail del backend en errores HTTP.
 * - El token se obtiene de un getter inyectado desde useAuth.
 */

const _rawUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").trim();
// Forzar HTTPS en URLs que no sean localhost (evita Mixed Content en Vercel)
const API_URL = _rawUrl.startsWith("http://") && !_rawUrl.includes("localhost")
  ? "https://" + _rawUrl.slice(7)
  : _rawUrl;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Getter de token inyectado por AuthProvider al montar
let _getToken: (() => string | null) | null = null;

export function setTokenGetter(getter: () => string | null): void {
  _getToken = getter;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = _getToken?.();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({ detail: "Error desconocido" }));

  if (!response.ok) {
    const detail = data.detail ?? "Error del servidor";
    if (response.status === 401 && detail === "sesion_desplazada") {
      window.dispatchEvent(new CustomEvent("sesion-desplazada"));
    }
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  /** Para descargas de archivos binarios (PDF). */
  getBlob: async (path: string): Promise<Blob> => {
    const token = _getToken?.();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${path}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ detail: "Error desconocido" }));
      throw new ApiError(response.status, data.detail ?? "Error del servidor");
    }
    return response.blob();
  },
};
