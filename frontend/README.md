# Dictum — Frontend

React SPA for the Dictum medical imaging report management system. Provides role-based interfaces for doctors (report authoring), administrative staff (print queue), and system administrators (user management).

## Tech Stack

- **React 18** — UI library
- **TypeScript 5** — static typing
- **Vite** — build tool and dev server
- **Tailwind CSS 3** — utility-first styling
- **TanStack Query v5** — server state management and caching
- **React Router v6** — client-side routing with protected routes

## Project Structure

```
frontend/src/
├── api/
│   ├── client.ts          # Base HTTP client (attaches JWT, handles 401)
│   ├── auth.ts            # Login, logout, refresh endpoints
│   ├── pacientes.ts       # Patient API calls
│   ├── informes.ts        # Report API calls + PDF download
│   └── imagenes.ts        # Image upload/list/delete
├── components/
│   ├── InformeForm.tsx    # Shared report form (protocol preloading, draft/finalize)
│   └── ui/
│       ├── AppHeader.tsx  # Top navigation bar with IDM branding
│       ├── Button.tsx     # Button with variants (primary, secondary, ghost)
│       ├── Input.tsx      # Labeled input with focus styles
│       └── LoadingSpinner.tsx
├── data/
│   └── protocolos.ts      # 16 preset report templates by study type
├── hooks/
│   ├── useAuth.ts         # Auth context consumer
│   └── useInformes.ts     # TanStack Query hooks for report operations
│   └── usePacientes.ts    # TanStack Query hooks for patient operations
├── pages/
│   ├── Login.tsx          # Split-panel login page
│   ├── medico/
│   │   ├── Dashboard.tsx       # Report list with pagination and PDF download
│   │   ├── NuevoInforme.tsx    # Patient selection + report creation
│   │   ├── EditarInforme.tsx   # Report editing + image management
│   │   ├── VerInforme.tsx      # Read-only report view
│   │   └── Pacientes.tsx       # Patient management
│   ├── secretaria/
│   │   └── ColaImpresion.tsx   # Finalized reports queue with filters and pagination
│   └── admin/
│       └── GestionUsuarios.tsx # User creation and activation/deactivation
├── types/
│   └── index.ts           # TypeScript interfaces (Informe, Paciente, AuthUser, etc.)
├── App.tsx                # QueryClient, AuthContext, inactivity timeout logic
└── router.tsx             # Route definitions with ProtectedRoute by role
```

## Key Features

### Role-based routing
Three separate interfaces behind `ProtectedRoute` — unauthorized access redirects to login regardless of URL.

### Session management
Access token stored in React memory only (never `localStorage`). Refresh token in `sessionStorage`. Automatic session expiry after **2 hours of inactivity**, with a 10-minute warning modal and a "Keep session open" button.

### Protocol preloading
When creating a report, selecting a study type auto-fills the content field with the corresponding medical protocol template. If the field already has content, a "Load base protocol" button appears with a confirmation dialog.

### Pagination
Both the doctor dashboard and the print queue display records in pages of 20. Filters apply across the full dataset — pagination resets automatically when filters change.

### PDF download
Triggers a backend request that generates the PDF in memory and returns it as a blob. The browser initiates a file download without any intermediate storage.

## Local Setup

```bash
npm install
```

Create `.env`:

```env
VITE_API_URL=http://localhost:8000
```

Run:

```bash
npm run dev
```

App available at `http://localhost:5173`.

Build for production:

```bash
npm run build
```

## Deployment (Vercel)

1. Set **Root Directory** to `frontend` in Vercel project settings
2. Framework preset: **Vite** (auto-detected)
3. Add environment variable:

```
VITE_API_URL=https://<your-railway-backend>.up.railway.app
```

Vercel handles the build (`npm run build`) and serves the static output automatically.
