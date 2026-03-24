# Dictum — Sistema de Gestión de Informes Médicos

Sistema web privado para el **Instituto de Diagnóstico Médico (IDM)** de San Salvador, Entre Ríos, Argentina. Permite a médicos crear, editar y finalizar informes de estudios por imágenes (ecografías, radiografías), y a la secretaría descargar los informes finalizados en formato PDF.

---

## Características

- **Médico**: crear pacientes, crear y editar informes con protocolos precargados por tipo de estudio, adjuntar imágenes, finalizar informes, descargar PDF.
- **Secretaría**: visualizar cola de impresión con filtros, descargar PDF de informes finalizados.
- **Admin**: crear, activar y desactivar usuarios del sistema.
- **PDF generado en memoria**: nunca se escribe a disco, se sirve directamente al navegador.
- **Seguridad**: autenticación JWT (Supabase Auth), Row Level Security en base de datos, rate limiting en login, headers de seguridad HTTP, audit log de todas las acciones sensibles.
- **Sesión con timeout**: cierre automático por inactividad (2 horas) con advertencia de 10 minutos.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript 5 |
| Estilos | Tailwind CSS 3 |
| Data fetching | TanStack Query v5 |
| Routing | React Router v6 |
| Backend | FastAPI + Python 3.12 |
| Base de datos | Supabase (PostgreSQL) con RLS |
| Autenticación | Supabase Auth (JWT ES256) |
| Storage de imágenes | Supabase Storage |
| Generación de PDF | WeasyPrint + Jinja2 |
| Rate limiting | slowapi |
| Deploy frontend | Vercel |
| Deploy backend | Railway (Docker) |

---

## Estructura del proyecto

```
Dictum/
├── backend/               # API REST con FastAPI
│   ├── app/
│   │   ├── main.py        # Entrada de la aplicación, middlewares, routers
│   │   ├── config.py      # Variables de entorno (Pydantic Settings)
│   │   ├── db_client.py   # Clientes de Supabase
│   │   ├── dependencies.py # Validación de JWT y roles
│   │   ├── routers/       # Endpoints por dominio
│   │   ├── schemas/       # Modelos Pydantic (request/response)
│   │   ├── services/      # Lógica de negocio
│   │   └── templates/     # Template HTML para PDF
│   ├── Dockerfile         # Build para Railway (incluye libs GTK para WeasyPrint)
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/              # SPA con React + Vite
│   ├── src/
│   │   ├── api/           # Llamadas HTTP al backend
│   │   ├── components/    # Componentes reutilizables
│   │   ├── data/          # Protocolos precargados por tipo de estudio
│   │   ├── hooks/         # React hooks (auth, queries)
│   │   ├── pages/         # Páginas por rol (medico/, secretaria/, admin/)
│   │   ├── types/         # Interfaces TypeScript
│   │   ├── App.tsx        # Raíz: contexto auth, timer de inactividad
│   │   └── router.tsx     # Definición de rutas protegidas
│   ├── public/
│   └── index.html
│
├── supabase/              # Migraciones SQL
├── docker-compose.yml     # Desarrollo local con Docker (opcional)
└── .gitignore
```

---

## Configuración local

### Requisitos previos

- Python 3.12+
- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Crear `backend/.env` con:

```env
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ALLOWED_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```

Iniciar el servidor:

```bash
uvicorn app.main:app --reload --port 8000
```

API disponible en `http://localhost:8000`. Documentación Swagger en `http://localhost:8000/docs` (solo en desarrollo).

### Frontend

```bash
cd frontend
npm install
```

Crear `frontend/.env` con:

```env
VITE_API_URL=http://localhost:8000
```

Iniciar:

```bash
npm run dev
```

App disponible en `http://localhost:5173`.

---

## Variables de entorno

### Backend (producción — Railway)

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta (solo backend, nunca frontend) |
| `ALLOWED_ORIGINS` | URL del frontend en Vercel |
| `ENVIRONMENT` | `production` (desactiva Swagger) |

### Frontend (producción — Vercel)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend en Railway |

---

## Deploy

### Backend → Railway

1. Conectar repositorio en [railway.app](https://railway.app)
2. Configurar **Root Directory** → `backend`
3. Railway detecta el `Dockerfile` automáticamente
4. Agregar las variables de entorno de producción
5. El Dockerfile instala GTK/Pango/Cairo necesarios para WeasyPrint

### Frontend → Vercel

1. Importar repositorio en [vercel.com](https://vercel.com)
2. Configurar **Root Directory** → `frontend`
3. Framework: Vite (detección automática)
4. Agregar variable `VITE_API_URL` apuntando al backend de Railway

---

## Seguridad

- **JWT en memoria**: el access token nunca se persiste en `localStorage`. Se guarda en React state.
- **Refresh token en sessionStorage**: se borra automáticamente al cerrar el navegador.
- **RLS en Supabase**: cada tabla tiene políticas que limitan el acceso según el rol del usuario autenticado.
- **Rate limiting**: máximo 50 intentos de login por IP cada 15 minutos en producción.
- **Headers HTTP**: `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`.
- **Audit log**: todas las acciones sensibles (login, crear/modificar/eliminar informes, descargar PDFs, gestión de usuarios) quedan registradas en la tabla `audit_log`.
- **service_role_key**: usada exclusivamente en el backend para crear/eliminar usuarios. Nunca expuesta al frontend.

---

## Notas de desarrollo

- Los PDFs se generan con **WeasyPrint** que requiere librerías GTK del sistema. En Windows de desarrollo, instalar [GTK for Windows Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer). En producción (Docker/Linux) funciona sin pasos adicionales.
- Swagger UI solo disponible con `ENVIRONMENT=development`.
- La secretaría solo puede ver y descargar informes en estado `finalizado`.
