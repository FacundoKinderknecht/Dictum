"""
Script de configuración ONE-TIME para obtener el refresh_token de OneDrive personal.

Uso:
    cd backend
    python scripts/get_onedrive_token.py

Requiere que en Azure:
  - Redirect URI: http://localhost:8080/callback  (platform: Web)
  - Account types: personal Microsoft accounts habilitados
  - Permisos delegados: Files.ReadWrite, offline_access
"""

import http.server
import urllib.parse
import webbrowser
import os

import httpx

CLIENT_ID     = os.environ.get("AZURE_CLIENT_ID", "a1a86c53-b456-4348-9ede-4fc602913e3e")
CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "")
REDIRECT_URI  = "http://localhost:8080/callback"
SCOPES        = "https://graph.microsoft.com/Files.ReadWrite offline_access"
AUTH_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"

if not CLIENT_SECRET:
    CLIENT_SECRET = input("Pegá el Client Secret de Azure: ").strip()

auth_url = (
    f"{AUTH_ENDPOINT}"
    f"?client_id={CLIENT_ID}"
    f"&response_type=code"
    f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
    f"&scope={urllib.parse.quote(SCOPES)}"
    f"&response_mode=query"
    f"&prompt=consent"
)

print("\nAbriendo navegador para autenticación con Microsoft...")
print(f"Si no se abre, abrí esta URL manualmente:\n\n{auth_url}\n")
webbrowser.open(auth_url)

code_received: list[str] = []


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            code_received.append(params["code"][0])
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"<h2>Autenticaci\xf3n exitosa. Pods cerrar esta ventana.</h2>"
            )
        else:
            error = params.get("error_description", ["error desconocido"])[0]
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Error: {error}".encode())

    def log_message(self, *args):
        pass


server = http.server.HTTPServer(("localhost", 8080), _Handler)
print("Esperando que completes el login en el navegador...\n")
while not code_received:
    server.handle_request()

# Intercambiar code por tokens
resp = httpx.post(
    TOKEN_ENDPOINT,
    data={
        "grant_type":    "authorization_code",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code":          code_received[0],
        "redirect_uri":  REDIRECT_URI,
        "scope":         SCOPES,
    },
    timeout=15,
)

data = resp.json()

if "refresh_token" in data:
    print("=" * 60)
    print("REFRESH TOKEN OBTENIDO EXITOSAMENTE")
    print("=" * 60)
    print("\nAgregá esta variable de entorno en Railway:\n")
    print(f"  AZURE_REFRESH_TOKEN={data['refresh_token']}")
    print("\nY eliminá AZURE_ONEDRIVE_USER si la tenías.")
    print("=" * 60)
else:
    print("ERROR al obtener el token:")
    print(data)
