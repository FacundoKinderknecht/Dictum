# Dictum — Sistema de Gestión de Informes Médicos

Sistema web privado para el **Instituto de Diagnóstico Médico (IDM)** de San Salvador, Entre Ríos, Argentina. Permite a médicos crear, editar y finalizar informes de estudios por imágenes (ecografías, radiografías), adjuntar imágenes, y descargar los informes en PDF. Los informes finalizados se archivan automáticamente en OneDrive.

---

## Características

- **Médico**: crear pacientes, crear y editar informes con protocolos precargados, adjuntar imágenes, finalizar informes, descargar PDF.
- **Secretaría**: visualizar cola de impresión con filtros, descargar PDF de informes finalizados.
- **Admin**: crear, activar y desactivar usuarios del sistema.
- **PDF generado en memoria**: con logo IDM, formato institucional. Nunca se escribe a disco.
- **Archivo en OneDrive**: al finalizar un informe, el PDF y las imágenes se suben automáticamente a OneDrive personal organizado por año/mes/paciente/tipo.
- **Presencia en tiempo real**: al editar un informe se muestra quién más lo está viendo simultáneamente (estilo Google Docs).
- **Múltiples sesiones**: varios dispositivos pueden estar conectados al mismo tiempo con el mismo usuario.
- **Seguridad**: autenticación JWT (Supabase Auth), Row Level Security en base de datos, rate limiting en login, headers de seguridad HTTP, audit log de todas las acciones sensibles.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript 5 |
| Estilos | Tailwind CSS 3 |
| Data fetching | TanStack Query v5 |
| Routing | React Router v6 |
| Realtime | Supabase Realtime (presencia) |
| Backend | FastAPI + Python 3.12 |
| Base de datos | Supabase (PostgreSQL) con RLS |
| Autenticación | Supabase Auth (JWT) |
| Storage de imágenes | Supabase Storage |
| Generación de PDF | fpdf2 |
| Archivo en nube | Microsoft OneDrive (Microsoft Graph API) |
| Rate limiting | slowapi |
| Deploy frontend | Vercel |
| Deploy backend | Railway (Docker) |

---

## Estructura del proyecto

```
Dictum/
├── backend/
│   ├── app/
│   │   ├── main.py           # Entrada, middlewares, routers
│   │   ├── config.py         # Variables de entorno (Pydantic Settings)
│   │   ├── dependencies.py   # Validación JWT y roles
│   │   ├── routers/          # Endpoints por dominio
│   │   ├── schemas/          # Modelos Pydantic
│   │   ├── services/         # Lógica de negocio (pdf, onedrive, auth)
│   │   └── static/           # Logo IDM para el PDF
│   ├── scripts/
│   │   └── get_onedrive_token.py  # Setup one-time de OneDrive
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/              # Llamadas HTTP al backend
│   │   ├── components/       # Componentes reutilizables (InformesLista, InformeForm…)
│   │   ├── data/             # Protocolos precargados por tipo de estudio
│   │   ├── hooks/            # React hooks (auth, queries, presencia)
│   │   ├── lib/              # Cliente Supabase (realtime)
│   │   ├── pages/            # Páginas por rol
│   │   └── types/            # Interfaces TypeScript
│   └── public/
│       └── logo_idm.png
│
├── supabase/                 # Migraciones SQL
└── docker-compose.yml
```

---

## Configuración local

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

Crear `backend/.env`:

```env
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_ORIGINS=http://localhost:5173
ENVIRONMENT=development

# OneDrive (opcional en desarrollo)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_REFRESH_TOKEN=
```

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Crear `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

```bash
npm run dev
```

---

## Variables de entorno en producción

### Backend (Railway)

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta (solo backend) |
| `ALLOWED_ORIGINS` | URLs del frontend separadas por coma |
| `ENVIRONMENT` | `production` (desactiva Swagger) |
| `AZURE_CLIENT_ID` | App registration de Azure |
| `AZURE_CLIENT_SECRET` | Secret de la app de Azure |
| `AZURE_REFRESH_TOKEN` | Obtenido con `scripts/get_onedrive_token.py` |

### Frontend (Vercel)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend en Railway |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de Supabase (seguro exponer) |

---

## Configuración de OneDrive (one-time)

```bash
cd backend
python scripts/get_onedrive_token.py
```

Sigue las instrucciones en pantalla. Al finalizar, agrega `AZURE_REFRESH_TOKEN` en Railway.

---

## Seguridad

- **JWT en memoria**: el access token nunca se persiste en `localStorage`.
- **Refresh token en sessionStorage**: se borra al cerrar el navegador.
- **RLS en Supabase**: políticas por rol en todas las tablas.
- **Rate limiting**: 5 intentos de login por IP cada 15 minutos.
- **Headers HTTP**: `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, etc.
- **Audit log**: todas las acciones sensibles quedan registradas (ley 25.326).
- **service_role_key**: exclusivo del backend, nunca expuesto al frontend.
