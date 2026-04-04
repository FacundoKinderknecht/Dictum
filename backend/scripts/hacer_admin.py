"""
Asigna rol 'admin' a un usuario existente por email.

Uso:
    cd backend
    python scripts/hacer_admin.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client
from app.config import settings

EMAIL_ADMIN = "kinderknechtfacundo@gmail.com"

client = create_client(settings.supabase_url, settings.supabase_service_role_key)

# Buscar el usuario en Auth
auth_users = client.auth.admin.list_users()
user = next((u for u in auth_users if u.email and u.email.lower() == EMAIL_ADMIN.lower()), None)

if not user:
    print(f"[error] No se encontró ningún usuario con email {EMAIL_ADMIN}")
    sys.exit(1)

uid = str(user.id)
print(f"[ok] Usuario encontrado: {uid}")

# Verificar si ya tiene profile
profile_result = client.table("profiles").select("id, rol, activo").eq("id", uid).execute()

if profile_result.data:
    # Actualizar rol existente
    client.table("profiles").update({"rol": "admin", "activo": True}).eq("id", uid).execute()
    print(f"[ok] Rol actualizado a 'admin' para {EMAIL_ADMIN}")
else:
    # Crear profile si no existe (ej. usuario creado directamente en Supabase)
    client.table("profiles").insert({
        "id": uid,
        "nombre": "Admin",
        "apellido": "",
        "rol": "admin",
        "activo": True,
    }).execute()
    print(f"[ok] Profile creado con rol 'admin' para {EMAIL_ADMIN}")

print("\nListo. Ya podés iniciar sesión con ese email como admin.")
