"""Generación de PDF en memoria con WeasyPrint + Jinja2.

El PDF nunca se escribe a disco ni a storage.
"""
import io
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

# WeasyPrint requiere librerías GTK del sistema operativo.
# En Windows de desarrollo el import se hace lazy (dentro de generar_pdf)
# para que el servidor arranque aunque GTK no esté instalado.
# En producción (Docker/Linux) el import al arrancar es correcto.

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _calcular_edad(fecha_nacimiento: date | None) -> str | None:
    if not fecha_nacimiento:
        return None
    today = date.today()
    years = today.year - fecha_nacimiento.year - (
        (today.month, today.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    return f"{years} años"


def generar_pdf(informe: dict, paciente: dict, medico: dict) -> bytes:
    """Renderiza el template HTML y genera el PDF en memoria.

    Args:
        informe: dict con los datos del informe
        paciente: dict con los datos del paciente
        medico: dict con nombre y apellido del médico informante

    Returns:
        bytes del PDF generado
    """
    fecha_nacimiento = paciente.get("fecha_nacimiento")
    if isinstance(fecha_nacimiento, str) and fecha_nacimiento:
        fecha_nacimiento = date.fromisoformat(fecha_nacimiento)

    # ID acortado para el pie de página (primeros 8 chars del UUID)
    id_corto = str(informe["id"])[:8].upper()

    template = _jinja_env.get_template("informe_pdf.html")
    html_content = template.render(
        informe=informe,
        paciente=paciente,
        medico=medico,
        edad=_calcular_edad(fecha_nacimiento),
        id_corto=id_corto,
        fecha_emision=date.today().strftime("%d/%m/%Y"),
    )

    try:
        from weasyprint import HTML
    except OSError as exc:
        raise RuntimeError(
            "WeasyPrint no puede cargar las librerías GTK del sistema. "
            "En Windows: instalar GTK runtime desde "
            "https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer "
            "y reiniciar la terminal. En Docker/Linux funciona sin pasos adicionales."
        ) from exc

    buffer = io.BytesIO()
    HTML(string=html_content).write_pdf(buffer)
    return buffer.getvalue()
