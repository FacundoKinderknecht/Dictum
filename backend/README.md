# Dictum — Backend

REST API built with **FastAPI** (Python 3.12) for the Dictum medical imaging report management system. Handles authentication, patient and report management, image storage, and on-the-fly PDF generation.

## Tech Stack

- **FastAPI** — async REST framework
- **Supabase** (PostgreSQL + Auth + Storage) — database, authentication, and file storage
- **WeasyPrint + Jinja2** — server-side PDF generation from HTML templates (never written to disk)
- **slowapi** — rate limiting
- **Pydantic v2** — request/response validation and settings management
- **Docker** — containerized deployment with GTK/Pango/Cairo dependencies for WeasyPrint

## Project Structure

```
backend/
├── app/
│   ├── main.py            # App entry point, CORS, security headers, routers
│   ├── config.py          # Environment variables via Pydantic Settings
│   ├── db_client.py       # Supabase client factory (user-scoped + admin)
│   ├── dependencies.py    # JWT validation (ES256 via JWKS), role enforcement
│   ├── routers/
│   │   ├── auth.py        # Login, logout, token refresh
│   │   ├── pacientes.py   # Patient CRUD
│   │   ├── informes.py    # Report CRUD (medico) + finalized list (secretaria)
│   │   ├── pdf.py         # On-demand PDF generation and download
│   │   ├── imagenes.py    # Image upload/list/delete via Supabase Storage
│   │   └── admin.py       # User management (admin role only)
│   ├── schemas/
│   │   ├── informe.py     # InformeCreate, InformeUpdate, InformeOut
│   │   ├── paciente.py    # PacienteCreate, PacienteOut
│   │   └── usuario.py     # UsuarioCreate, LoginRequest, LoginResponse
│   ├── services/
│   │   ├── auth_service.py    # Supabase Auth sign-in/out/refresh
│   │   ├── audit_service.py   # Audit log writer
│   │   ├── informe_service.py # Shared helpers (get_or_404, assert_borrador)
│   │   └── pdf_service.py     # WeasyPrint HTML → PDF bytes
│   └── templates/
│       └── informe_pdf.html   # Jinja2 PDF template
├── Dockerfile             # Linux image with GTK libs for WeasyPrint
├── requirements.txt
├── .env.example
└── tests/
```

## API Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Authenticate, returns JWT + refresh token |
| POST | `/auth/logout` | any | Invalidate session |
| POST | `/auth/refresh` | — | Refresh access token |
| GET | `/pacientes/` | medico | List patients |
| POST | `/pacientes/` | medico | Create patient |
| GET | `/pacientes/{id}` | medico | Get patient |
| PUT | `/pacientes/{id}` | medico | Update patient |
| GET | `/informes/mis-informes` | medico | List own reports |
| POST | `/informes/` | medico | Create report (draft) |
| GET | `/informes/{id}` | medico | Get report |
| PUT | `/informes/{id}` | medico | Update report (supports estado transition) |
| DELETE | `/informes/{id}` | medico | Delete report |
| GET | `/informes/finalizados/lista` | secretaria | List finalized reports |
| GET | `/informes/{id}/pdf` | medico, secretaria | Download PDF |
| POST | `/informes/{id}/imagenes` | medico | Upload image |
| GET | `/informes/{id}/imagenes` | medico | List images (signed URLs) |
| DELETE | `/informes/{id}/imagenes/{filename}` | medico | Delete image |
| GET | `/admin/usuarios` | admin | List users |
| POST | `/admin/usuarios` | admin | Create user |
| PATCH | `/admin/usuarios/{id}/activar` | admin | Activate user |
| PATCH | `/admin/usuarios/{id}/desactivar` | admin | Deactivate user |
| GET | `/health` | — | Health check |

## Local Setup

```bash
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
```

Create `.env`:

```env
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ALLOWED_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```

Run:

```bash
uvicorn app.main:app --reload --port 8000
```

Swagger UI available at `http://localhost:8000/docs` (development only).

## Security

- JWT validated via Supabase JWKS endpoint (ES256), with 1-hour cache
- Every endpoint checks both token validity and user role via `require_role()`
- Row Level Security (RLS) enforced at the database level — users can only access their own data even if the API is bypassed
- `service_role_key` used exclusively for admin user creation/deletion
- Login rate-limited to 50 requests per 15 minutes per IP in production
- Security headers: `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`
- All sensitive actions logged to `audit_log` table

## PDF Generation

PDFs are generated entirely in memory using WeasyPrint + a Jinja2 HTML template. They are never written to disk or stored in Supabase Storage. The template renders patient data, study details, report content, doctor signature, and a footer with report ID.

> **Note:** WeasyPrint requires GTK native libraries. On Windows, install the [GTK for Windows Runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer). On Linux/Docker (production), it works out of the box.

## Deployment

Railway detects the `Dockerfile` automatically. The Dockerfile installs the required system libraries (`libpango`, `libcairo2`, `libgdk-pixbuf2.0`) before installing Python dependencies.

Required environment variables on Railway:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
ENVIRONMENT=production
```
