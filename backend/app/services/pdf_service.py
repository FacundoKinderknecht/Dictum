"""Generación de PDF en memoria con fpdf2 (sin dependencias del sistema)."""
from datetime import date
import io

from fpdf import FPDF


def _calcular_edad(fecha_nacimiento: date | None) -> str | None:
    if not fecha_nacimiento:
        return None
    today = date.today()
    years = today.year - fecha_nacimiento.year - (
        (today.month, today.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    return f"{years}"


def _latin1_safe(text: str) -> str:
    """Reemplaza caracteres fuera de Latin-1 con equivalentes ASCII."""
    _MAP = {
        "\u2014": "-",    # em dash —
        "\u2013": "-",    # en dash –
        "\u2018": "'",    # ' left single quote
        "\u2019": "'",    # ' right single quote
        "\u201c": '"',    # " left double quote
        "\u201d": '"',    # " right double quote
        "\u2026": "...",  # … ellipsis
        "\u2022": "*",    # • bullet
        "\u00a0": " ",    # non-breaking space
    }
    result = []
    for ch in text:
        if ch in _MAP:
            result.append(_MAP[ch])
        elif ord(ch) > 255:
            result.append("?")
        else:
            result.append(ch)
    return "".join(result)


def _fmt_fecha(valor) -> str:
    if not valor:
        return ""
    if isinstance(valor, str):
        try:
            return date.fromisoformat(valor).strftime("%d/%m/%Y")
        except ValueError:
            return valor
    if hasattr(valor, "strftime"):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


class _InformePDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(180, 180, 180)
        self.cell(0, 4, "Instituto de Diagnostico Medico  -  San Salvador, Entre Rios, Argentina", align="C")
        self.set_text_color(0, 0, 0)


def generar_pdf(informe: dict, paciente: dict, medico: dict) -> bytes:
    """Genera el PDF del informe en memoria y retorna los bytes."""
    fecha_nac_raw = paciente.get("fecha_nacimiento")
    fecha_nac: date | None = None
    if isinstance(fecha_nac_raw, str) and fecha_nac_raw:
        try:
            fecha_nac = date.fromisoformat(fecha_nac_raw)
        except ValueError:
            pass
    elif isinstance(fecha_nac_raw, date):
        fecha_nac = fecha_nac_raw

    fecha_estudio = _fmt_fecha(informe.get("fecha_estudio"))
    edad = _calcular_edad(fecha_nac)

    pdf = _InformePDF(format="A4")
    pdf.set_margins(left=20, top=15, right=20)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # ── Header ───────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 9, "Instituto de Diagnostico Medico", new_x="LMARGIN", new_y="NEXT", align="L")

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(
        0, 4,
        "ECOGRAFIA  -  MAMOGRAFIA DIGITAL  -  RADIOLOGIA DIGITAL DIRECTA  -  ECO DOPPLER COLOR  -  ECOGRAFIA 5D  -  ESPINOGRAFIA",
        new_x="LMARGIN", new_y="NEXT", align="L",
    )
    pdf.ln(1)

    # Línea roja
    pdf.set_draw_color(220, 38, 38)
    pdf.set_line_width(0.6)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.set_draw_color(0, 0, 0)
    pdf.ln(4)
    pdf.set_text_color(0, 0, 0)

    # ── Datos (dos columnas, sin títulos de sección) ──────────────────────────
    W = pdf.w - pdf.l_margin - pdf.r_margin  # ancho útil
    COL = W / 2

    def dato_par(label_l: str, val_l: str, label_r: str, val_r: str) -> None:
        """Fila con dato a la izquierda y dato a la derecha."""
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(22, 5, _latin1_safe(label_l))
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(COL - 22, 5, _latin1_safe(val_l))
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(24, 5, _latin1_safe(label_r))
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, _latin1_safe(val_r), new_x="LMARGIN", new_y="NEXT")

    def dato_full(label: str, val: str) -> None:
        """Fila que ocupa todo el ancho."""
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(30, 5, _latin1_safe(label))
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, _latin1_safe(val), new_x="LMARGIN", new_y="NEXT")

    nombre_paciente = f"{paciente.get('apellido', '').upper()}, {paciente.get('nombre', '').upper()}"
    dato_par(
        "Paciente:", nombre_paciente,
        "Edad:", f"{edad} años" if edad else "",
    )

    dato_par(
        "DNI:", str(paciente.get("dni", "")),
        "Fecha:", fecha_estudio,
    )

    if informe.get("medico_solicitante"):
        dato_full("Med. Solicitante:", str(informe["medico_solicitante"]))

    medico_nombre = f"Dr/a. {medico.get('apellido', '')}, {medico.get('nombre', '')}"
    dato_full("Med. Informante:", medico_nombre)

    dato_full(
        "Estudio:",
        _latin1_safe(str(informe.get("tipo_estudio", ""))),
    )

    pdf.ln(3)

    # Línea separadora gris
    pdf.set_draw_color(180, 180, 180)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_draw_color(0, 0, 0)
    pdf.ln(5)

    # ── Contenido del informe ─────────────────────────────────────────────────
    contenido = (informe.get("contenido") or "").strip()
    if contenido:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 5, _latin1_safe(contenido), new_x="LMARGIN", new_y="NEXT", align="L")
        pdf.set_text_color(0, 0, 0)

    buffer = io.BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
