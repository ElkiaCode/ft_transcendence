#!/usr/bin/env python3

import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "explication.md"
OUTPUT = ROOT / "explication.pdf"


def register_fonts():
    candidates = [
        (
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
        ),
        (
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
        ),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ),
    ]
    for regular, bold, mono in candidates:
        if Path(regular).exists() and Path(bold).exists() and Path(mono).exists():
            pdfmetrics.registerFont(TTFont("GuideSans", regular))
            pdfmetrics.registerFont(TTFont("GuideSans-Bold", bold))
            pdfmetrics.registerFont(TTFont("GuideMono", mono))
            pdfmetrics.registerFontFamily(
                "GuideSans",
                normal="GuideSans",
                bold="GuideSans-Bold",
            )
            return
    raise RuntimeError("DejaVu fonts are required to generate the PDF")


def inline_markup(text):
    escaped = html.escape(text, quote=False)
    escaped = re.sub(
        r"`([^`]+)`",
        r'<font name="GuideMono" color="#0f4c5c">\1</font>',
        escaped,
    )
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    return escaped


def build_styles():
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="GuideSans",
            fontSize=9.2,
            leading=13.2,
            textColor=colors.HexColor("#25313c"),
            spaceAfter=6,
            alignment=TA_LEFT,
        ),
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="GuideSans-Bold",
            fontSize=30,
            leading=36,
            textColor=colors.HexColor("#12344d"),
            alignment=TA_CENTER,
            spaceAfter=18,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="GuideSans",
            fontSize=15,
            leading=21,
            textColor=colors.HexColor("#277da1"),
            alignment=TA_CENTER,
            spaceAfter=18,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading1"],
            fontName="GuideSans-Bold",
            fontSize=18,
            leading=23,
            textColor=colors.HexColor("#12344d"),
            spaceBefore=12,
            spaceAfter=9,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading2"],
            fontName="GuideSans-Bold",
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor("#277da1"),
            spaceBefore=8,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="GuideSans",
            fontSize=9.1,
            leading=12.8,
            leftIndent=14,
            firstLineIndent=-8,
            textColor=colors.HexColor("#25313c"),
            spaceAfter=3,
        ),
        "number": ParagraphStyle(
            "Number",
            parent=base["BodyText"],
            fontName="GuideSans",
            fontSize=9.1,
            leading=12.8,
            leftIndent=18,
            firstLineIndent=-12,
            textColor=colors.HexColor("#25313c"),
            spaceAfter=3,
        ),
        "quote": ParagraphStyle(
            "Quote",
            parent=base["BodyText"],
            fontName="GuideSans",
            fontSize=9.1,
            leading=13,
            leftIndent=12,
            rightIndent=8,
            borderColor=colors.HexColor("#43aa8b"),
            borderWidth=0.8,
            borderPadding=7,
            backColor=colors.HexColor("#edf8f4"),
            textColor=colors.HexColor("#234238"),
            spaceBefore=5,
            spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "Code",
            fontName="GuideMono",
            fontSize=7.8,
            leading=10.2,
            leftIndent=8,
            rightIndent=8,
            borderColor=colors.HexColor("#c9d6df"),
            borderWidth=0.6,
            borderPadding=7,
            backColor=colors.HexColor("#f4f7f9"),
            textColor=colors.HexColor("#1f2933"),
            spaceBefore=5,
            spaceAfter=8,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            fontName="GuideSans-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            fontName="GuideSans",
            fontSize=7.7,
            leading=10,
            textColor=colors.HexColor("#25313c"),
        ),
        "footer": ParagraphStyle(
            "Footer",
            fontName="GuideSans",
            fontSize=7,
            textColor=colors.HexColor("#6b7b88"),
        ),
    }


def parse_table(lines, styles, available_width):
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        rows.append(cells)
    if len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in rows[1]):
        rows.pop(1)
    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    rendered = []
    for row_index, row in enumerate(normalized):
        style = styles["table_header"] if row_index == 0 else styles["table_cell"]
        rendered.append([Paragraph(inline_markup(cell), style) for cell in row])
    widths = [available_width / column_count] * column_count
    table = Table(rendered, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#277da1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#b8c5ce")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
                    colors.white,
                    colors.HexColor("#f4f7f9"),
                ]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def parse_markdown(text, styles, available_width):
    lines = text.splitlines()
    story = []
    paragraph_lines = []
    code_lines = []
    in_code = False
    table_lines = []
    first_h1 = True

    def flush_paragraph():
        nonlocal paragraph_lines
        if paragraph_lines:
            content = " ".join(line.strip() for line in paragraph_lines)
            story.append(Paragraph(inline_markup(content), styles["body"]))
            paragraph_lines = []

    def flush_table():
        nonlocal table_lines
        if table_lines:
            story.append(parse_table(table_lines, styles, available_width))
            story.append(Spacer(1, 8))
            table_lines = []

    for line in lines:
        if line.strip().startswith("```"):
            flush_paragraph()
            flush_table()
            if in_code:
                story.append(Preformatted("\n".join(code_lines), styles["code"]))
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if line.strip() == "<!-- pagebreak -->":
            flush_paragraph()
            flush_table()
            story.append(PageBreak())
            continue

        if line.startswith("|") and line.rstrip().endswith("|"):
            flush_paragraph()
            table_lines.append(line)
            continue
        flush_table()

        if not line.strip():
            flush_paragraph()
            continue

        if line.startswith("# "):
            flush_paragraph()
            title = line[2:].strip()
            if first_h1:
                story.extend(
                    [
                        Spacer(1, 4.0 * cm),
                        Paragraph(inline_markup(title), styles["title"]),
                        HRFlowable(
                            width="65%",
                            thickness=2,
                            color=colors.HexColor("#43aa8b"),
                            spaceBefore=4,
                            spaceAfter=18,
                            hAlign="CENTER",
                        ),
                    ]
                )
                first_h1 = False
            else:
                story.append(Paragraph(inline_markup(title), styles["h2"]))
            continue

        if line.startswith("## "):
            flush_paragraph()
            heading = line[3:].strip()
            if heading == "Guide global du projet et préparation à la soutenance":
                story.append(Paragraph(inline_markup(heading), styles["subtitle"]))
            else:
                story.append(Paragraph(inline_markup(heading), styles["h2"]))
            continue

        if line.startswith("### "):
            flush_paragraph()
            story.append(
                Paragraph(inline_markup(line[4:].strip()), styles["h3"])
            )
            continue

        if line.startswith("> "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line[2:].strip()), styles["quote"]))
            continue

        bullet = re.match(r"^-\s+(.*)", line)
        if bullet:
            flush_paragraph()
            story.append(
                Paragraph(
                    f"•&nbsp;&nbsp;{inline_markup(bullet.group(1))}",
                    styles["bullet"],
                )
            )
            continue

        numbered = re.match(r"^(\d+)\.\s+(.*)", line)
        if numbered:
            flush_paragraph()
            story.append(
                Paragraph(
                    f"{numbered.group(1)}.&nbsp;&nbsp;{inline_markup(numbered.group(2))}",
                    styles["number"],
                )
            )
            continue

        paragraph_lines.append(line)

    flush_paragraph()
    flush_table()
    return story


def draw_page(canvas, doc):
    page = canvas.getPageNumber()
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(colors.HexColor("#d7e0e6"))
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 1.35 * cm, width - doc.rightMargin, 1.35 * cm)
    canvas.setFont("GuideSans", 7)
    canvas.setFillColor(colors.HexColor("#6b7b88"))
    canvas.drawString(doc.leftMargin, 0.85 * cm, "Transcendence — guide de soutenance")
    canvas.drawRightString(width - doc.rightMargin, 0.85 * cm, f"Page {page}")
    canvas.restoreState()


def main():
    register_fonts()
    styles = build_styles()
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=1.65 * cm,
        leftMargin=1.65 * cm,
        topMargin=1.55 * cm,
        bottomMargin=1.7 * cm,
        title="Transcendence - Guide global du projet et préparation à la soutenance",
        author="Projet Transcendence",
        subject="Architecture, sécurité, Prisma, NestJS, React, WebSockets, Docker et questions de soutenance",
    )
    story = parse_markdown(
        SOURCE.read_text(encoding="utf-8"),
        styles,
        A4[0] - document.leftMargin - document.rightMargin,
    )
    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    print(OUTPUT)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PDF generation failed: {error}", file=sys.stderr)
        raise
