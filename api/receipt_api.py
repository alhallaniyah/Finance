from flask import Flask, request, make_response, jsonify
import os
import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfdoc

app = Flask(__name__)

# ===== FONT SETUP (Arabic + English) =====
UNICODE_FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
pdfmetrics.registerFont(TTFont("ArialUnicode", UNICODE_FONT))

# ===== UTILS =====
def fmt_amount(val):
    try:
        return f"{float(val):.2f} AED"
    except Exception:
        return "0.00 AED"

# ===== PDF BUILDER =====
def build_receipt_pdf(payload: dict) -> bytes:
    width_pt = 80 * mm       # 80mm width (≈226.77pt)
    margin = 8
    line_h = 14

    # --- Data Extraction ---
    company_name = payload.get("companyName", "Company Name")
    company_address = payload.get("companyAddress", "")
    company_phone = payload.get("companyPhone", "")
    receipt_no = payload.get("receiptNo", "-")
    date = payload.get("date", datetime.now().strftime("%d/%m/%Y"))
    payment_method = payload.get("paymentMethod", "-")
    items = payload.get("items", []) or []
    total = payload.get("total", 0)
    paid_amount = payload.get("paidAmount", total)

    # --- STEP 1: Use tall temporary canvas to measure content ---
    temp_height = 1000 * mm  # temporary large page
    temp_buf = io.BytesIO()
    c = canvas.Canvas(temp_buf, pagesize=(width_pt, temp_height))
    c.setTitle("Receipt")

    def draw_center(text, y, size=11):
        c.setFont("ArialUnicode", size)
        w = c.stringWidth(text, "ArialUnicode", size)
        c.drawString((width_pt - w) / 2, y, text)

    def draw_left(text, x, y, size=10):
        c.setFont("ArialUnicode", size)
        c.drawString(x, y, text)

    def draw_right(text, x_right, y, size=10):
        c.setFont("ArialUnicode", size)
        w = c.stringWidth(text, "ArialUnicode", size)
        c.drawString(x_right - w, y, text)

    # --- Draw header + items, track Y position ---
    y = temp_height - margin - 10
    draw_center(company_name, y, size=12)
    y -= line_h
    if company_address:
        draw_center(company_address, y)
        y -= line_h
    if company_phone:
        draw_center(f"Phone: {company_phone}", y)
        y -= line_h
    y -= 4
    c.setLineWidth(0.6)
    c.line(margin, y, width_pt - margin, y)
    y -= line_h

    # --- Info ---
    draw_left("Receipt No:", margin, y); y -= line_h
    draw_left(str(receipt_no), margin + 10, y); y -= line_h + 4

    draw_left("Payment Method:", margin, y); y -= line_h
    draw_left(payment_method.upper(), margin + 10, y); y -= line_h + 4

    draw_left("Date:", margin, y); y -= line_h
    draw_left(str(date), margin + 10, y); y -= line_h + 8

    # --- Items ---
    c.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_center("ITEMS", y, size=11)
    y -= (line_h + 4)

    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"

        draw_left(name, margin, y)
        y -= line_h - 2
        draw_left(meta, margin + 4, y)
        draw_right(fmt_amount(total_line), width_pt - margin, y)
        y -= (line_h + 4)

    # --- Totals ---
    y -= 2
    c.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_left("Items count:", margin, y)
    draw_right(str(len(items)), width_pt - margin, y)
    y -= line_h
    draw_left("TOTAL:", margin, y)
    draw_right(fmt_amount(total), width_pt - margin, y)
    y -= line_h
    draw_left("Paid amount:", margin, y)
    draw_right(fmt_amount(paid_amount), width_pt - margin, y)
    y -= line_h + 10
    draw_center("Thank you for your purchase!", y, size=10)

    c.save()

    # --- STEP 2: Compute actual used height ---
    used_height = temp_height - (y - margin)
    final_height = max(used_height, 100 * mm)  # ensure a minimum height

    # --- STEP 3: Redraw on final canvas with exact height ---
    buf = io.BytesIO()
    page_size = (width_pt, final_height)
    c2 = canvas.Canvas(buf, pagesize=page_size)
    c2.setTitle("Receipt")

    # === Redraw (identical content, exact height now) ===
    y = final_height - margin - 10
    draw_center(company_name, y, size=12)
    y -= line_h
    if company_address:
        draw_center(company_address, y)
        y -= line_h
    if company_phone:
        draw_center(f"Phone: {company_phone}", y)
        y -= line_h
    y -= 4
    c2.setLineWidth(0.6)
    c2.line(margin, y, width_pt - margin, y)
    y -= line_h

    draw_left("Receipt No:", margin, y); y -= line_h
    draw_left(str(receipt_no), margin + 10, y); y -= line_h + 4
    draw_left("Payment Method:", margin, y); y -= line_h
    draw_left(payment_method.upper(), margin + 10, y); y -= line_h + 4
    draw_left("Date:", margin, y); y -= line_h
    draw_left(str(date), margin + 10, y); y -= line_h + 8

    c2.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_center("ITEMS", y, size=11)
    y -= (line_h + 4)

    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"
        draw_left(name, margin, y)
        y -= line_h - 2
        draw_left(meta, margin + 4, y)
        draw_right(fmt_amount(total_line), width_pt - margin, y)
        y -= (line_h + 4)

    y -= 2
    c2.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_left("Items count:", margin, y)
    draw_right(str(len(items)), width_pt - margin, y)
    y -= line_h
    draw_left("TOTAL:", margin, y)
    draw_right(fmt_amount(total), width_pt - margin, y)
    y -= line_h
    draw_left("Paid amount:", margin, y)
    draw_right(fmt_amount(paid_amount), width_pt - margin, y)
    y -= line_h + 10
    draw_center("Thank you for your purchase!", y, size=10)

    # --- Force correct print size boxes ---
    c2._pagesize = page_size
    c2._doc.pagesize = page_size
    for page in c2._doc.Pages:
        page.MediaBox = pdfdoc.PDFArray([0, 0, width_pt, final_height])
        page.CropBox = pdfdoc.PDFArray([0, 0, width_pt, final_height])
        page.TrimBox = pdfdoc.PDFArray([0, 0, width_pt, final_height])
        page.BleedBox = pdfdoc.PDFArray([0, 0, width_pt, final_height])

    c2.save()
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes

# ===== CORS + ROUTE =====
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route("/api/generate-receipt", methods=["POST", "OPTIONS"])
def generate_receipt():
    if request.method == "OPTIONS":
        resp = make_response("")
        resp.status_code = 204
        return resp

    try:
        data = request.get_json(force=True) or {}
        pdf = build_receipt_pdf(data)

        receipt_no = data.get("receiptNo", "noid")
        date_str = datetime.now().strftime("%Y%m%d")
        filename = f"receipt_{receipt_no}_{date_str}.pdf"

        resp = make_response(pdf)
        resp.headers["Content-Type"] = "application/pdf"
        resp.headers["Content-Disposition"] = f"inline; filename={filename}"
        resp.headers["Content-Length"] = str(len(pdf))
        return resp

    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
