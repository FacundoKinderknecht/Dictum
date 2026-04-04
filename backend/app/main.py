import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.routers import admin, auth, imagenes, informes, pacientes, pdf

logging.basicConfig(level=logging.INFO)

# ── Rate limiter (instancia global compartida con auth.py) ────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Aplicación ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="IDM — Sistema de Informes Médicos",
    version="1.0.0",
    docs_url="/docs"        if not settings.is_production else None,
    redoc_url="/redoc"      if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

app.state.limiter = limiter

# ── Exception handlers ────────────────────────────────────────────────────────
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger(__name__).error("Unhandled error: %s", exc, exc_info=True)
    origin = request.headers.get("origin", "")
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers={"Access-Control-Allow-Origin": origin} if origin else {},
    )

# ── Security headers ──────────────────────────────────────────────────────────
# IMPORTANTE: este middleware se agrega ANTES que CORSMiddleware en el código,
# por eso en runtime CORSMiddleware corre PRIMERO (los middlewares se apilan en
# orden inverso al de registro en Starlette).
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]    = "nosniff"
    response.headers["X-Frame-Options"]           = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
    return response

# ── CORS — debe agregarse DESPUÉS del @middleware para ser el más externo ─────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(pacientes.router, prefix="/pacientes", tags=["pacientes"])
app.include_router(informes.router,  prefix="/informes",  tags=["informes"])
app.include_router(imagenes.router,  prefix="/informes",  tags=["imagenes"])
app.include_router(pdf.router,       prefix="/informes",  tags=["pdf"])
app.include_router(admin.router,     prefix="/admin",     tags=["admin"])

# ── Startup: asegurar que el bucket de imágenes exista ───────────────────────
_startup_logger = logging.getLogger("startup")

@app.on_event("startup")
async def ensure_storage_bucket() -> None:
    """Crea el bucket 'informe-imagenes' si no existe. Fallo no crítico."""
    from app.dependencies import get_admin_client
    BUCKET = "informe-imagenes"
    try:
        client = get_admin_client()
        buckets = client.storage.list_buckets()
        existing = [b.name for b in buckets]
        if BUCKET not in existing:
            client.storage.create_bucket(BUCKET, options={"public": False})
            _startup_logger.info("Bucket '%s' creado.", BUCKET)
        else:
            _startup_logger.info("Bucket '%s' ya existe.", BUCKET)
    except Exception as exc:
        _startup_logger.error("No se pudo verificar/crear bucket '%s': %s", BUCKET, exc)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok"}
