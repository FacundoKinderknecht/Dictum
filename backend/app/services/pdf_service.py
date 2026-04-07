"""Generación de PDF en memoria con fpdf2 (sin dependencias del sistema)."""
from datetime import date
import io
import os

from fpdf import FPDF

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
LOGO_PATH  = os.path.join(STATIC_DIR, "logo_idm.png")


def _calcular_edad(fecha_nacimiento: date | None) -> str | None:
    if not fecha_nacimiento:
        return None
    today = date.today()
    years = today.year - fecha_nacimiento.year - (
        (today.month, today.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    )
    return str(years)


def _latin1_safe(text: str) -> str:
    _MAP = {
        "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u2022": "*", "\u00a0": " ",
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
        self.set_font("Arial", "", 8)
        self.set_text_color(180, 180, 180)
        self.cell(0, 4, "Instituto de Diagnostico Medico  -  San Salvador, Entre Rios, Argentina", align="C")
        self.set_text_color(0, 0, 0)


def generar_pdf(informe: dict, paciente: dict, medico: dict, con_membrete: bool = True) -> bytes:
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
    # Sin membrete: margen superior de ~4 cm para no superponer el membrete pre-impreso
    top_margin = 55 if not con_membrete else 14
    pdf.set_margins(left=18, top=top_margin, right=18)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    W = pdf.w - pdf.l_margin - pdf.r_margin

    # ── HEADER (solo con membrete) ────────────────────────────────────────────────
    if con_membrete:
        LOGO_W = 28
        TEXT_X = pdf.l_margin + LOGO_W + 4

        logo_exists = os.path.isfile(LOGO_PATH)

        if logo_exists:
            pdf.image(LOGO_PATH, x=pdf.l_margin, y=pdf.get_y(), w=LOGO_W)
        else:
            pdf.set_font("Helvetica", "B", 26)
            pdf.set_text_color(220, 38, 38)
            pdf.set_xy(pdf.l_margin, pdf.get_y())
            pdf.cell(LOGO_W, 14, "idm", align="C")
            pdf.set_text_color(0, 0, 0)

        y_header = pdf.get_y()
        pdf.set_xy(TEXT_X, y_header)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(220, 38, 38)
        pdf.cell(W - LOGO_W - 4, 6, "Instituto de Diagnostico Medico", new_x="LMARGIN", new_y="NEXT")

        pdf.set_xy(TEXT_X, pdf.get_y())
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(W - LOGO_W - 4, 4,
                 "ECOGRAFIA  -  MAMOGRAFIA DIGITAL  -  RADIOLOGIA DIGITAL DIRECTA",
                 new_x="LMARGIN", new_y="NEXT")

        pdf.set_xy(TEXT_X, pdf.get_y())
        pdf.cell(W - LOGO_W - 4, 4,
                 "ECO DOPPLER COLOR  -  ECOGRAFIA 5D  -  ESPINOGRAFIA",
                 new_x="LMARGIN", new_y="NEXT")

        pdf.set_text_color(0, 0, 0)

        logo_bottom = y_header + (LOGO_W * 0.6 if logo_exists else 14)
        if pdf.get_y() < logo_bottom:
            pdf.set_y(logo_bottom)

        pdf.ln(3)

        pdf.set_draw_color(220, 38, 38)
        pdf.set_line_width(0.7)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.set_line_width(0.2)
        pdf.set_draw_color(0, 0, 0)
        pdf.ln(4)

    # ── DATOS DEL PACIENTE ───────────────────────────────────────────────────────
    COL = W / 2

    def fila(label_l: str, val_l: str, label_r: str = "", val_r: str = "") -> None:
        pdf.set_font("Arial", "B", 12)
        pdf.cell(len(label_l) * 2.6 + 1, 6.5, _latin1_safe(label_l))
        pdf.set_font("Arial", "", 12)
        pdf.cell(COL - (len(label_l) * 2.6 + 1), 6.5, _latin1_safe(val_l))
        if label_r:
            pdf.set_font("Arial", "B", 12)
            pdf.cell(len(label_r) * 2.6 + 1, 6.5, _latin1_safe(label_r))
            pdf.set_font("Arial", "", 12)
            pdf.cell(0, 6.5, _latin1_safe(val_r), new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.ln(6.5)

    nombre_pac = f"{paciente.get('apellido', '').upper()} {paciente.get('nombre', '').upper()}"
    fila("Paciente: ", nombre_pac, "Edad: ", f"{edad} años" if edad else "")
    fila(
        "Medico Solicitante: ",
        _latin1_safe(str(informe.get("medico_solicitante") or "")).upper(),
        "Fecha: ", fecha_estudio,
    )

    tipo_label = _latin1_safe(str(informe.get("tipo_estudio", "") or "")).upper()
    pdf.set_font("Arial", "B", 12)
    pdf.cell(32, 6.5, "Ecografia: ")
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 6.5, tipo_label, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(2)

    # Línea gris separadora
    pdf.set_draw_color(160, 160, 160)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_draw_color(0, 0, 0)
    pdf.ln(5)

    # ── CONTENIDO ────────────────────────────────────────────────────────────────
    contenido = (informe.get("contenido") or "").strip()
    if contenido:
        pdf.set_font("Arial", "", 12)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(0, 6, _latin1_safe(contenido), align="L")
        pdf.set_text_color(0, 0, 0)

    pdf.ln(8)

    # Firma del médico (vacía si no hay datos — ej. secretaria)
    line_w = 60
    if medico.get("nombre") or medico.get("apellido"):
        medico_nombre = f"Dr/a. {medico.get('apellido', '')}, {medico.get('nombre', '')}"
        matricula = medico.get("matricula") or ""
        pdf.set_font("Arial", "", 12)
        pdf.cell(0, 6, _latin1_safe(medico_nombre), align="R", new_x="LMARGIN", new_y="NEXT")
        if matricula:
            pdf.set_font("Arial", "", 11)
            pdf.set_text_color(80, 80, 80)
            pdf.cell(0, 5, _latin1_safe(matricula), align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)

    pdf.set_draw_color(80, 80, 80)
    pdf.set_line_width(0.3)
    pdf.line(pdf.w - pdf.r_margin - line_w, pdf.get_y(),
             pdf.w - pdf.r_margin, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.set_draw_color(0, 0, 0)

    buffer = io.BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
