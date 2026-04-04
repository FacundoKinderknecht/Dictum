"""
Borra usuarios de prueba de Supabase Auth y sus profiles.

Uso:
    cd backend
    python scripts/borrar_usuarios_prueba.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client
from app.config import settings

EMAILS_A_BORRAR = ["a@a", "b@b"]

client = create_client(settings.supabase_url, settings.supabase_service_role_key)

auth_users = client.auth.admin.list_users()

borrados = 0
for email in EMAILS_A_BORRAR:
    user = next((u for u in auth_users if u.email and u.email.lower() == email.lower()), None)
    if not user:
        print(f"  [skip] {email} — no encontrado")
        continue

    uid = str(user.id)

    # Borrar profile (por si acaso — ON DELETE CASCADE debería encargarse)
    try:
        client.table("profiles").delete().eq("id", uid).execute()
    except Exception as e:
        print(f"  [warn] No se pudo borrar profile de {email}: {e}")

    # Borrar usuario de Auth
    try:
        client.auth.admin.delete_user(uid)
        print(f"  [ok]   {email} borrado (id={uid})")
        borrados += 1
    except Exception as e:
        print(f"  [error] No se pudo borrar {email} de Auth: {e}")

print(f"\n{borrados}/{len(EMAILS_A_BORRAR)} usuarios borrados.")
