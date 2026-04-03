# FEATURE_BATCH_2.md — IDM San Salvador
# Conjunto de cambios: permisos, navegación, buscador y Google Drive

---

## Resumen de cambios

1. Médico puede leer informes de otros médicos (solo lectura)
2. Múltiples sesiones simultáneas por cuenta (ya funciona, verificar)
3. Buscador global de informes en el dashboard del médico
4. Click en paciente → lista de todos sus informes
5. Click en médico → lista de todos sus informes
6. Google Drive como storage de PDFs e imágenes (reemplaza Supabase Storage)

---

## CAMBIO 1 — Médico puede leer informes de otros médicos

### Backend — RLS (`supabase/migrations/`)

Agregar nueva política que permite a médicos leer informes de otros médicos,
pero NO editarlos ni eliminarlos:

```sql
-- Un médico puede leer TODOS los informes (propios y de otros médicos)
-- La política existente "informes_medico_select" solo permitía ver los propios.
-- Reemplazarla por esta:
DROP POLICY IF EXISTS informes_medico_select ON informes;

CREATE POLICY informes_medico_read_all ON informes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND rol IN ('medico', 'secretaria')
            AND activo = true
        )
    );

-- Las políticas de INSERT y UPDATE siguen restringidas al médico propietario
-- (medico_id = auth.uid()) — no cambiar esas.
```

### Frontend

- En `Dashboard.tsx` del médico: mostrar TODOS los informes (no solo los propios).
  Agregar columna "Médico" en la tabla para identificar de quién es cada informe.
- Los botones "Editar" y "Eliminar" solo aparecen si `informe.medico_id === user.id`.
- Si el informe es de otro médico, solo aparece el botón "Ver".
- En `router.tsx`: la ruta `/medico/ver-informe/:id` debe ser accesible para
  cualquier médico, no solo el propietario.
- En `VerInforme.tsx`: no mostrar botones de edición si el informe no es del
  médico logueado.

---

## CAMBIO 2 — Múltiples sesiones simultáneas

Supabase Auth permite múltiples sesiones por defecto. Verificar que el backend
NO invalide otras sesiones al hacer login. En `routers/auth.py`, el endpoint
`POST /auth/login` no debe llamar a `signOut` de otras sesiones.

No debería requerir cambios, pero verificar y confirmar.

---

## CAMBIO 3 — Buscador global de informes en el dashboard

### Frontend — `pages/medico/Dashboard.tsx`

Agregar un input de búsqueda en la parte superior del dashboard que filtre
la lista de informes en tiempo real (client-side, sin request al servidor).

Campos de búsqueda: nombre del paciente, apellido del paciente, DNI, tipo de estudio.

```tsx
const [busqueda, setBusqueda] = useState('');

const informesFiltrados = useMemo(() => {
  if (!busqueda.trim()) return informes;
  const q = busqueda.toLowerCase();
  return informes?.filter(i =>
    `${i.paciente_nombre} ${i.paciente_apellido} ${i.paciente_dni} ${i.tipo_estudio}`
      .toLowerCase()
      .includes(q)
  ) ?? [];
}, [informes, busqueda]);
```

El input debe tener placeholder "Buscar por paciente, DNI o tipo de estudio..."
y un botón/ícono para limpiar la búsqueda (X).

---

## CAMBIO 4 — Click en paciente → lista de sus informes

### Frontend

**En cualquier lugar donde aparezca el nombre del paciente** (dashboard, ver informe):
convertir el nombre en un link que navega a `/medico/paciente/:id`.

Nueva página: `pages/medico/PerfilPaciente.tsx`
- Muestra datos del paciente (nombre, apellido, DNI, fecha de nacimiento, teléfono).
- Muestra tabla con todos sus informes (fecha, tipo de estudio, médico, estado).
- Cada informe tiene botón "Ver" (y "Editar" si es propio).
- Botón "Nuevo informe para este paciente" que navega a
  `/medico/nuevo-informe?paciente_id=:id` (ya funciona este query param).

### Backend — `routers/pacientes.py`

Nuevo endpoint:
```
GET /pacientes/{id}/informes → lista de todos los informes del paciente
```

Solo accesible para médicos. Devuelve `InformeConPaciente[]` igual que el endpoint
de mis-informes, pero filtrado por `paciente_id`.

### Router — `router.tsx`

Agregar ruta:
```tsx
{ path: "/medico/paciente/:id", element: <ProtectedRoute role="medico"><PerfilPaciente /></ProtectedRoute> }
```

---

## CAMBIO 5 — Click en médico → lista de sus informes

### Frontend

**En cualquier lugar donde aparezca el nombre del médico** (dashboard cuando se
ven informes de otros): convertir el nombre en un link que navega a
`/medico/perfil-medico/:id`.

Nueva página: `pages/medico/PerfilMedico.tsx`
- Muestra nombre completo del médico.
- Tabla con todos sus informes (los que el médico logueado puede ver).
- Misma lógica de botones: "Ver" siempre, "Editar" solo si es el propio usuario.

### Backend — `routers/informes.py`

Nuevo endpoint:
```
GET /informes/por-medico/{medico_id} → lista de informes de ese médico
```

Solo accesible para médicos. Devuelve `InformeConPaciente[]`.

---

## CAMBIO 6 — Google Drive como storage (reemplaza Supabase Storage)

> ⚠️ DECISIÓN TOMADA CON CONOCIMIENTO DE RIESGOS.
> La médico fue informada de las implicancias legales y de seguridad
> y decidió proceder con Google Drive igualmente.

### Autenticación con Drive — Service Account (obligatorio)

NO usar OAuth2 de usuario. Usar una **Service Account** de Google Cloud:
1. Crear proyecto en Google Cloud Console.
2. Crear Service Account → descargar JSON de credenciales.
3. Compartir la carpeta raíz de Drive de la médico con el email de la Service Account
   (darle permisos de Editor).
4. Guardar el JSON de credenciales como variable de entorno en Railway.

### Variables de entorno nuevas (`backend/.env`)

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
# Pegar el contenido completo del JSON de la service account como string.

GOOGLE_DRIVE_ROOT_FOLDER_ID=<id-de-la-carpeta-raiz-en-drive>
# El ID de la carpeta compartida en el Drive de la médico.
# Se obtiene de la URL de Drive: drive.google.com/drive/folders/ESTE_ID
```

### Dependencia nueva (`backend/requirements.txt`)

```
google-api-python-client==2.136.0
google-auth==2.29.0
google-auth-httplib2==0.2.0
```

### Nuevo servicio — `backend/app/services/drive_service.py`

```python
"""
Servicio de Google Drive para almacenamiento de PDFs e imágenes.
Reemplaza storage_service.py (Supabase Storage).
"""

# Estructura de carpetas en Drive:
# RAIZ/
# └── 2026/
#     └── Garcia_Juan_DNI12345678/
#         └── Ecografia_Abdominal/
#             └── 2026-03-17/
#                 ├── informe_<uuid>.pdf
#                 └── imagen_1.jpg

def get_or_create_folder(service, name: str, parent_id: str) -> str:
    """Busca una carpeta por nombre dentro del parent. Si no existe, la crea."""

def build_folder_path(paciente: dict, tipo_estudio: str, fecha: str) -> list[str]:
    """
    Construye la lista de carpetas a crear/navegar:
    [año, "Apellido_Nombre_DNI<dni>", tipo_estudio_sanitizado, fecha]
    
    Sanitizar nombres: reemplazar espacios por _, eliminar caracteres especiales.
    Ejemplo: "García, Juan" + DNI 12345678 → "Garcia_Juan_DNI12345678"
    """

def upload_pdf(pdf_bytes: bytes, informe_id: str, paciente: dict,
               tipo_estudio: str, fecha: str) -> str:
    """
    Sube el PDF a la carpeta correspondiente.
    Retorna el file ID de Drive.
    """

def upload_imagen(imagen_bytes: bytes, filename: str, informe_id: str,
                  paciente: dict, tipo_estudio: str, fecha: str) -> str:
    """
    Sube una imagen a la misma carpeta del informe.
    Retorna el file ID de Drive.
    """

def get_download_url(file_id: str) -> str:
    """
    Genera una URL de descarga directa desde Drive.
    Usar: f"https://drive.google.com/uc?export=download&id={file_id}"
    """

def delete_file(file_id: str) -> None:
    """Elimina un archivo de Drive por su file ID."""
```

### Cambios en la base de datos

La tabla `informes` necesita guardar el `file_id` de Drive del PDF (para poder
descargarlo o eliminarlo después):

```sql
-- Agregar en una nueva migration: 004_drive_storage.sql
ALTER TABLE informes ADD COLUMN IF NOT EXISTS drive_pdf_id TEXT;
```

La tabla de imágenes (si existe) también necesita `drive_file_id` en lugar de
la ruta de Supabase Storage.

Si las imágenes se guardan en una tabla separada, agregar:
```sql
ALTER TABLE informe_imagenes ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
-- Y eliminar o deprecar la columna de storage_path de Supabase.
```

### Cambios en `routers/pdf.py`

El endpoint `GET /informes/{id}/pdf` sigue generando el PDF en memoria con
WeasyPrint. Cambio: después de generarlo, subirlo a Drive con `drive_service.upload_pdf()`
y guardar el `drive_pdf_id` en la tabla `informes`.

En requests posteriores al mismo informe: si ya tiene `drive_pdf_id`,
servir redirect a la URL de Drive en lugar de regenerar. Esto ahorra CPU.

### Cambios en `routers/imagenes.py`

Reemplazar todas las llamadas a `storage_service` por `drive_service`:
- `POST /informes/{id}/imagenes` → `drive_service.upload_imagen()`
- `DELETE /informes/{id}/imagenes/{filename}` → `drive_service.delete_file(file_id)`
- `GET /informes/{id}/imagenes` → retornar URLs de Drive en lugar de signed URLs

### Eliminar dependencia de Supabase Storage

Una vez que Drive esté funcionando y probado:
- Remover `storage_service.py`
- Remover `SUPABASE_SERVICE_ROLE_KEY` si ya no se usa para nada más
  (verificar si todavía se usa para audit_log y admin)

---

## Orden de implementación recomendado

1. Cambio 1 (permisos de lectura) — es el más crítico, afecta RLS
2. Cambio 2 (verificar múltiples sesiones) — rápido
3. Cambio 3 (buscador) — solo frontend
4. Cambios 4 y 5 (perfiles de paciente y médico) — juntos, misma lógica
5. Cambio 6 (Google Drive) — último, es el más complejo y no bloquea nada

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `supabase/migrations/004_drive_storage.sql` | Crear — columnas drive_pdf_id |
| `supabase/migrations/005_rls_medico_read_all.sql` | Crear — nueva política RLS |
| `backend/app/services/drive_service.py` | Crear — integración Google Drive |
| `backend/app/routers/pdf.py` | Modificar — subir a Drive después de generar |
| `backend/app/routers/imagenes.py` | Modificar — usar Drive en vez de Supabase Storage |
| `backend/app/routers/informes.py` | Modificar — nuevos endpoints por paciente y médico |
| `backend/requirements.txt` | Modificar — agregar google-api-python-client |
| `frontend/src/pages/medico/Dashboard.tsx` | Modificar — buscador + columna médico + links |
| `frontend/src/pages/medico/PerfilPaciente.tsx` | Crear — lista de informes del paciente |
| `frontend/src/pages/medico/PerfilMedico.tsx` | Crear — lista de informes del médico |
| `frontend/src/router.tsx` | Modificar — nuevas rutas |
