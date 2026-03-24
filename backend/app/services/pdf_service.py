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
    return f"{years} años"


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
    def __init__(self, id_corto: str, fecha_emision: str):
        super().__init__(format="A4")
        self._id_corto = id_corto
        self._fecha_emision = fecha_emision

    def footer(self):
        self.set_y(-18)
        self.set_draw_color(180, 180, 180)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.set_y(-14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(130, 130, 130)
        half = (self.w - self.l_margin - self.r_margin) / 2
        self.cell(half, 4, "Instituto de Diagnóstico Médico — San Salvador, E.R.", align="L")
        self.cell(half, 4, f"Informe: {self._id_corto} | Emitido: {self._fecha_emision}", align="R")
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

    id_corto = str(informe["id"])[:8].upper()
    fecha_emision = date.today().strftime("%d/%m/%Y")

    pdf = _InformePDF(id_corto=id_corto, fecha_emision=fecha_emision)
    pdf.set_margins(left=20, top=20, right=20)
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.add_page()

    LABEL_W = 52  # mm — ancho de columna de etiquetas

    def section_title(text: str) -> None:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(50, 50, 50)
        pdf.cell(0, 5, text.upper(), new_x="LMARGIN", new_y="NEXT", align="L")
        pdf.set_draw_color(180, 180, 180)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(4)
        pdf.set_text_color(0, 0, 0)

    def data_row(label: str, value: str) -> None:
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(LABEL_W, 5, label)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, value, new_x="LMARGIN", new_y="NEXT", align="L")

    # ── Header ──────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(220, 38, 38)  # IDM red
    pdf.cell(120, 8, "Instituto de Diagnóstico Médico", align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 8, f"Informe N°: {id_corto}", new_x="LMARGIN", new_y="NEXT", align="R")

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(120, 5, "San Salvador, Entre Ríos, Argentina", align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, f"Fecha emisión: {fecha_emision}", new_x="LMARGIN", new_y="NEXT", align="R")
    pdf.ln(2)

    pdf.set_draw_color(30, 30, 30)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(6)
    pdf.set_text_color(0, 0, 0)

    # ── Datos del Paciente ───────────────────────────────────────────────────
    section_title("Datos del Paciente")
    data_row("Apellido y Nombre:", f"{paciente.get('apellido', '')}, {paciente.get('nombre', '')}")
    data_row("DNI:", str(paciente.get("dni", "")))
    if fecha_nac:
        edad = _calcular_edad(fecha_nac)
        fn_str = fecha_nac.strftime("%d/%m/%Y")
        data_row("Fecha de nacimiento:", f"{fn_str}  ({edad})" if edad else fn_str)
    if paciente.get("telefono"):
        data_row("Teléfono:", str(paciente["telefono"]))
    pdf.ln(3)

    # ── Datos del Estudio ────────────────────────────────────────────────────
    section_title("Datos del Estudio")
    data_row("Tipo de estudio:", str(informe.get("tipo_estudio", "")))
    data_row("Fecha del estudio:", _fmt_fecha(informe.get("fecha_estudio")))
    if informe.get("medico_solicitante"):
        data_row("Médico solicitante:", str(informe["medico_solicitante"]))
    medico_nombre = f"Dr/a. {medico.get('apellido', '')}, {medico.get('nombre', '')}"
    data_row("Médico informante:", medico_nombre)
    pdf.ln(3)

    # ── Contenido del informe ────────────────────────────────────────────────
    contenido = (informe.get("contenido") or "").strip()
    if contenido:
        section_title("Informe")
        pdf.set_font("Courier", "", 9)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 5, contenido, new_x="LMARGIN", new_y="NEXT", align="L")
        pdf.set_text_color(0, 0, 0)
        pdf.ln(3)

    # ── Firma ────────────────────────────────────────────────────────────────
    pdf.ln(10)
    firma_w = 70
    firma_x = pdf.w - pdf.r_margin - firma_w
    firma_y = pdf.get_y()
    pdf.set_draw_color(30, 30, 30)
    pdf.line(firma_x, firma_y, firma_x + firma_w, firma_y)
    pdf.ln(3)
    pdf.set_x(firma_x)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(firma_w, 5, medico_nombre, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(firma_x)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(firma_w, 5, "Médico Informante", align="C", new_x="LMARGIN", new_y="NEXT")

    buffer = io.BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
