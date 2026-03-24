import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    # Swagger/ReDoc solo en desarrollo
    docs_url="/docs"        if not settings.is_production else None,
    redoc_url="/redoc"      if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

app.state.limiter = limiter

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]     = "nosniff"
    response.headers["X-Frame-Options"]            = "DENY"
    response.headers["Strict-Transport-Security"]  = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"]    = "default-src 'self'"
    response.headers["Referrer-Policy"]            = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]         = "geolocation=(), microphone=(), camera=()"
    return response

# ── Exception handlers ────────────────────────────────────────────────────────
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger(__name__).error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(pacientes.router, prefix="/pacientes", tags=["pacientes"])
app.include_router(informes.router,  prefix="/informes",  tags=["informes"])
app.include_router(imagenes.router,  prefix="/informes",  tags=["imagenes"])
app.include_router(pdf.router,       prefix="/informes",  tags=["pdf"])
app.include_router(admin.router,     prefix="/admin",     tags=["admin"])

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok"}
