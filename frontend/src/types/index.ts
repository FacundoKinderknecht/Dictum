// ── Roles ─────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "medico" | "secretaria";

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  token: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  rol: UserRole;
  nombre: string;
  apellido: string;
}

// ── Pacientes ─────────────────────────────────────────────────────────────────
export interface Paciente {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
  created_at: string;
}

export interface PacienteCreate {
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento?: string;
  telefono?: string;
}

export interface PacienteUpdate {
  nombre?: string;
  apellido?: string;
  fecha_nacimiento?: string;
  telefono?: string;
}

// ── Informes ──────────────────────────────────────────────────────────────────
export type EstadoInforme = "borrador" | "finalizado";

export interface Informe {
  id: string;
  paciente_id: string;
  medico_id: string;
  tipo_estudio: string;
  fecha_estudio: string;
  medico_solicitante: string | null;
  contenido: string | null;
  estado: EstadoInforme;
  created_at: string;
  updated_at: string;
}

export interface ImagenInforme {
  path: string;
  url: string;
  nombre: string;
}

export interface InformeConPaciente extends Informe {
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_dni: string;
  paciente_fecha_nacimiento: string | null;
  medico_nombre: string;
  medico_apellido: string;
}

export interface InformeCreate {
  paciente_id: string;
  tipo_estudio: string;
  fecha_estudio: string;
  medico_solicitante?: string;
  contenido?: string;
}

export interface InformeUpdate {
  tipo_estudio?: string;
  fecha_estudio?: string;
  medico_solicitante?: string;
  contenido?: string;
}

// ── Usuarios (admin) ──────────────────────────────────────────────────────────
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  activo: boolean;
  created_at: string;
}

export interface UsuarioCreate {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: "medico" | "secretaria";
}

// ── Tipos de estudio y sus campos ─────────────────────────────────────────────
export interface CampoEstudio {
  key: string;
  label: string;
  tipo: "text" | "textarea";
}

export const TIPOS_ESTUDIO: Record<string, CampoEstudio[]> = {
  "Ecografía Abdominal": [
    { key: "higado",     label: "Hígado",      tipo: "textarea" },
    { key: "vesicula",   label: "Vesícula",    tipo: "textarea" },
    { key: "pancreas",   label: "Páncreas",    tipo: "textarea" },
    { key: "bazo",       label: "Bazo",        tipo: "textarea" },
    { key: "riniones",   label: "Riñones",     tipo: "textarea" },
    { key: "conclusion", label: "Conclusión",  tipo: "textarea" },
  ],
  "Ecografía Obstétrica": [
    { key: "edad_gestacional",  label: "Edad gestacional",  tipo: "text"     },
    { key: "biometria",         label: "Biometría fetal",   tipo: "textarea" },
    { key: "placenta",          label: "Placenta",          tipo: "textarea" },
    { key: "liquido_amniotico", label: "Líquido amniótico", tipo: "text"     },
    { key: "conclusion",        label: "Conclusión",        tipo: "textarea" },
  ],
  "Ecografía Pélvica": [
    { key: "utero",         label: "Útero",         tipo: "textarea" },
    { key: "ovario_der",    label: "Ovario derecho", tipo: "textarea" },
    { key: "ovario_izq",    label: "Ovario izquierdo", tipo: "textarea" },
    { key: "conclusion",    label: "Conclusión",    tipo: "textarea" },
  ],
  "Doppler Vascular": [
    { key: "vasos_evaluados", label: "Vasos evaluados", tipo: "textarea" },
    { key: "hallazgos",       label: "Hallazgos",       tipo: "textarea" },
    { key: "conclusion",      label: "Conclusión",      tipo: "textarea" },
  ],
  "Ecografía de Partes Blandas": [
    { key: "region",     label: "Región evaluada", tipo: "text"     },
    { key: "hallazgos",  label: "Hallazgos",       tipo: "textarea" },
    { key: "conclusion", label: "Conclusión",      tipo: "textarea" },
  ],
};

export const TIPOS_ESTUDIO_KEYS = Object.keys(TIPOS_ESTUDIO);
