from flask import Flask, request, make_response, jsonify, redirect
import os
import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfdoc
import json
import urllib.parse
import requests

# ESC/POS + PIL for image-based printing (keeps layout and Unicode)
try:
    from escpos.printer import Network, Usb, Serial
    ESC_POS_AVAILABLE = True
except Exception:
    ESC_POS_AVAILABLE = False

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False

app = Flask(__name__)

# ===== FONT SETUP (Arabic + English) =====
UNICODE_FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
pdfmetrics.registerFont(TTFont("ArialUnicode", UNICODE_FONT))

# ===== ESC/POS PRINTER CONFIG =====
# Configure via environment variables. Defaults assume a network printer.
PRINTER_CONNECTION = os.environ.get("ESC_POS_CONNECTION", "network").strip().lower()  # network|usb|serial
PRINTER_HOST = os.environ.get("ESC_POS_HOST", "192.168.70.124")
PRINTER_PORT = int(os.environ.get("ESC_POS_PORT", "9100"))

# USB config (use hex like 0x04b8 for Epson vendor id)
def _parse_int(val: str, default: int = 0) -> int:
    try:
        val = (val or "").strip().lower()
        if val.startswith("0x"):
            return int(val, 16)
        return int(val)
    except Exception:
        return default

USB_VENDOR_ID = _parse_int(os.environ.get("ESC_POS_VENDOR_ID", "0x0000"))
USB_PRODUCT_ID = _parse_int(os.environ.get("ESC_POS_PRODUCT_ID", "0x0000"))
USB_IN_EP = _parse_int(os.environ.get("ESC_POS_USB_IN_EP", "0x82"))
USB_OUT_EP = _parse_int(os.environ.get("ESC_POS_USB_OUT_EP", "0x01"))

# Serial config
SERIAL_PORT = os.environ.get("ESC_POS_SERIAL_PORT", "/dev/ttyUSB0")
SERIAL_BAUD = _parse_int(os.environ.get("ESC_POS_SERIAL_BAUD", "19200"), 19200)


def get_printer():
    """Return an ESC/POS printer instance based on environment configuration."""
    if not ESC_POS_AVAILABLE:
        raise RuntimeError("python-escpos not installed. pip install python-escpos")
    if PRINTER_CONNECTION == "network":
        return Network(PRINTER_HOST, PRINTER_PORT)
    if PRINTER_CONNECTION == "usb":
        if not (USB_VENDOR_ID and USB_PRODUCT_ID):
            raise RuntimeError("USB printer requires ESC_POS_VENDOR_ID and ESC_POS_PRODUCT_ID")
        return Usb(USB_VENDOR_ID, USB_PRODUCT_ID, in_ep=USB_IN_EP, out_ep=USB_OUT_EP)
    if PRINTER_CONNECTION == "serial":
        return Serial(devfile=SERIAL_PORT, baudrate=SERIAL_BAUD)
    raise RuntimeError(f"Unsupported ESC_POS_CONNECTION: {PRINTER_CONNECTION}")


def load_font(size: int) -> ImageFont.FreeTypeFont:
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow not installed. pip install pillow")
    try:
        return ImageFont.truetype(UNICODE_FONT, size)
    except Exception:
        # Fallback to a default font if Arial Unicode is unavailable
        return ImageFont.load_default()


def build_receipt_image(payload: dict) -> Image.Image:
    """Render the receipt into a monochrome image suitable for ESC/POS printing.

    Keeps layout similar to the PDF by drawing text and lines using PIL.
    """
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow not installed. pip install pillow")

    # Printer image width: typical 80mm printer printable width ~576 dots (203dpi)
    width_px = int(os.environ.get("ESC_POS_WIDTH_PX", "576"))
    margin = 16
    line_h = 28

    # Extract data
    company_name = payload.get("companyName", "Company Name")
    company_address = payload.get("companyAddress", "")
    company_phone = payload.get("companyPhone", "")
    receipt_no = payload.get("receiptNo", "-")
    date = payload.get("date", datetime.now().strftime("%d/%m/%Y"))
    payment_method = payload.get("paymentMethod", "-")
    items = payload.get("items", []) or []
    total = payload.get("total", 0)
    paid_amount = payload.get("paidAmount", total)

    # Fonts
    font_large = load_font(28)
    font_medium = load_font(24)
    font_small = load_font(22)

    # Temporary tall canvas to measure
    temp_height = 4000
    img = Image.new("L", (width_px, temp_height), color=255)  # L mode for 1-channel
    draw = ImageDraw.Draw(img)

    def draw_center(text, y, font):
        text = str(text).replace("\n", " ").replace("\r", " ")
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        x = (width_px - w) // 2
        draw.text((x, y), text, font=font, fill=0)

    def draw_left(text, x, y, font):
        draw.text((x, y), text, font=font, fill=0)

    def draw_right(text, x_right, y, font):
        text = str(text).replace("\n", " ").replace("\r", " ")
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text((x_right - w, y), text, font=font, fill=0)

    # Header
    y = margin
    draw_center(company_name, y, font_large)
    y += line_h
    if company_address:
        draw_center(company_address, y, font_medium)
        y += line_h
    if company_phone:
        draw_center(f"Phone: {company_phone}", y, font_medium)
        y += line_h
    # divider
    y += 6
    draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h

    # Info
    draw_left("Receipt No:", margin, y, font_small)
    y += line_h
    draw_left(str(receipt_no), margin + 10, y, font_small)
    y += line_h + 4

    draw_left("Payment Method:", margin, y, font_small)
    y += line_h
    draw_left(str(payment_method).upper(), margin + 10, y, font_small)
    y += line_h + 4

    draw_left("Date:", margin, y, font_small)
    y += line_h
    draw_left(str(date), margin + 10, y, font_small)
    y += line_h + 8

    # Items header
    draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h
    draw_center("ITEMS", y, font_medium)
    y += line_h + 4

    def _fmt_amount(val):
        try:
            return f"{float(val):.2f} AED"
        except Exception:
            return "0.00 AED"

    # Items loop
    item_sum = 0
    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"

        draw_left(name, margin, y, font_small)
        y += line_h - 2
        draw_left(meta, margin + 4, y, font_small)
        draw_right(_fmt_amount(total_line), width_px - margin, y, font_small)
        y += line_h + 4
        try:
            item_sum += float(total_line)
        except Exception:
            pass

    # Totals
    y += 2
    draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h
    draw_left("Items count:", margin, y, font_small)
    draw_right(str(len(items)), width_px - margin, y, font_small)
    y += line_h

    subtotal_val = payload.get("subtotal")
    vat_val = payload.get("vat")
    if subtotal_val is None:
        subtotal_val = item_sum
    if vat_val is None:
        try:
            vat_val = max(float(total) - float(subtotal_val or 0), 0)
        except Exception:
            vat_val = 0

    draw_left("Subtotal:", margin, y, font_small)
    draw_right(_fmt_amount(subtotal_val), width_px - margin, y, font_small)
    y += line_h
    draw_left("VAT:", margin, y, font_small)
    draw_right(_fmt_amount(vat_val), width_px - margin, y, font_small)
    y += line_h
    draw_left("TOTAL:", margin, y, font_small)
    draw_right(_fmt_amount(total), width_px - margin, y, font_small)
    y += line_h
    draw_left("Paid amount:", margin, y, font_small)
    draw_right(_fmt_amount(paid_amount), width_px - margin, y, font_small)
    y += line_h + 10
    draw_center("Thank you for your purchase!", y, font_small)

    final_height = max(y + margin + 10, 800)
    final_img = Image.new("L", (width_px, int(final_height)), color=255)
    final_draw = ImageDraw.Draw(final_img)

    # Redraw on final canvas for crisp edges
    y = margin
    def redraw_center(text, y, font):
        text = str(text).replace("\n", " ").replace("\r", " ")
        bbox = final_draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        x = (width_px - w) // 2
        final_draw.text((x, y), text, font=font, fill=0)

    def redraw_left(text, x, y, font):
        final_draw.text((x, y), text, font=font, fill=0)

    def redraw_right(text, x_right, y, font):
        text = str(text).replace("\n", " ").replace("\r", " ")
        bbox = final_draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        final_draw.text((x_right - w, y), text, font=font, fill=0)

    redraw_center(company_name, y, font_large)
    y += line_h
    if company_address:
        redraw_center(company_address, y, font_medium)
        y += line_h
    if company_phone:
        redraw_center(f"Phone: {company_phone}", y, font_medium)
        y += line_h
    y += 6
    final_draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h

    redraw_left("Receipt No:", margin, y, font_small); y += line_h
    redraw_left(str(receipt_no), margin + 10, y, font_small); y += line_h + 4
    redraw_left("Payment Method:", margin, y, font_small); y += line_h
    redraw_left(str(payment_method).upper(), margin + 10, y, font_small); y += line_h + 4
    redraw_left("Date:", margin, y, font_small); y += line_h
    redraw_left(str(date), margin + 10, y, font_small); y += line_h + 8

    final_draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h
    redraw_center("ITEMS", y, font_medium)
    y += line_h + 4

    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"
        redraw_left(name, margin, y, font_small)
        y += line_h - 2
        redraw_left(meta, margin + 4, y, font_small)
        redraw_right(_fmt_amount(total_line), width_px - margin, y, font_small)
        y += line_h + 4

    y += 2
    final_draw.line([(margin, y), (width_px - margin, y)], fill=0, width=1)
    y += line_h
    redraw_left("Items count:", margin, y, font_small)
    redraw_right(str(len(items)), width_px - margin, y, font_small)
    y += line_h
    redraw_left("Subtotal:", margin, y, font_small)
    redraw_right(_fmt_amount(subtotal_val), width_px - margin, y, font_small)
    y += line_h
    redraw_left("VAT:", margin, y, font_small)
    redraw_right(_fmt_amount(vat_val), width_px - margin, y, font_small)
    y += line_h
    redraw_left("TOTAL:", margin, y, font_small)
    redraw_right(_fmt_amount(total), width_px - margin, y, font_small)
    y += line_h
    redraw_left("Paid amount:", margin, y, font_small)
    redraw_right(_fmt_amount(paid_amount), width_px - margin, y, font_small)
    y += line_h + 10
    redraw_center("Thank you for your purchase!", y, font_small)

    return final_img


def print_receipt_escpos(payload: dict):
    """Print the receipt instantly via ESC/POS."""
    img = build_receipt_image(payload)
    printer = get_printer()
    try:
        # Some printers prefer binary (mode L) images; python-escpos handles conversion
        printer.image(img)
        # Optional: small feed before cut
        printer.cut()
    finally:
        # Ensure connection closes even if cut not supported
        try:
            printer.close()
        except Exception:
            pass

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

    # Canvas-agnostic text helpers (so we can reuse for final canvas)
    def draw_center(cnv, text, y, size=11):
        cnv.setFont("ArialUnicode", size)
        w = cnv.stringWidth(text, "ArialUnicode", size)
        cnv.drawString((width_pt - w) / 2, y, text)

    def draw_left(cnv, text, x, y, size=10):
        cnv.setFont("ArialUnicode", size)
        cnv.drawString(x, y, text)

    def draw_right(cnv, text, x_right, y, size=10):
        cnv.setFont("ArialUnicode", size)
        w = cnv.stringWidth(text, "ArialUnicode", size)
        cnv.drawString(x_right - w, y, text)

    # --- Draw header + items, track Y position ---
    y = temp_height - margin - 10
    draw_center(c, company_name, y, size=12)
    y -= line_h
    if company_address:
        draw_center(c, company_address, y)
        y -= line_h
    if company_phone:
        draw_center(c, f"Phone: {company_phone}", y)
        y -= line_h
    y -= 4
    c.setLineWidth(0.6)
    c.line(margin, y, width_pt - margin, y)
    y -= line_h

    # --- Info ---
    draw_left(c, "Receipt No:", margin, y); y -= line_h
    draw_left(c, str(receipt_no), margin + 10, y); y -= line_h + 4

    draw_left(c, "Payment Method:", margin, y); y -= line_h
    draw_left(c, payment_method.upper(), margin + 10, y); y -= line_h + 4

    draw_left(c, "Date:", margin, y); y -= line_h
    draw_left(c, str(date), margin + 10, y); y -= line_h + 8

    # --- Items ---
    c.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_center(c, "ITEMS", y, size=11)
    y -= (line_h + 4)

    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"

        draw_left(c, name, margin, y)
        y -= line_h - 2
        draw_left(c, meta, margin + 4, y)
        draw_right(c, fmt_amount(total_line), width_pt - margin, y)
        y -= (line_h + 4)

    # --- Totals ---
    y -= 2
    c.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_left(c, "Items count:", margin, y)
    draw_right(c, str(len(items)), width_pt - margin, y)

    # Subtotal & VAT handling
    # Prefer provided values; otherwise derive from items/total
    item_sum = 0
    for item in items:
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        item_sum += item.get("total", qty * price)

    subtotal_val = payload.get("subtotal")
    vat_val = payload.get("vat")
    if subtotal_val is None:
        subtotal_val = item_sum
    if vat_val is None:
        vat_val = max(total - float(subtotal_val or 0), 0)

    draw_left(c, "Subtotal:", margin, y)
    draw_right(c, fmt_amount(subtotal_val), width_pt - margin, y)
    y -= line_h
    draw_left(c, "VAT:", margin, y)
    draw_right(c, fmt_amount(vat_val), width_pt - margin, y)
    y -= line_h
    draw_left(c, "TOTAL:", margin, y)
    draw_right(c, fmt_amount(total), width_pt - margin, y)
    y -= line_h
    draw_left(c, "Paid amount:", margin, y)
    draw_right(c, fmt_amount(paid_amount), width_pt - margin, y)
    y -= line_h + 10
    draw_center(c, "Thank you for your purchase!", y, size=10)

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
    draw_center(c2, company_name, y, size=12)
    y -= line_h
    if company_address:
        draw_center(c2, company_address, y)
        y -= line_h
    if company_phone:
        draw_center(c2, f"Phone: {company_phone}", y)
        y -= line_h
    y -= 4
    c2.setLineWidth(0.6)
    c2.line(margin, y, width_pt - margin, y)
    y -= line_h

    draw_left(c2, "Receipt No:", margin, y); y -= line_h
    draw_left(c2, str(receipt_no), margin + 10, y); y -= line_h + 4
    draw_left(c2, "Payment Method:", margin, y); y -= line_h
    draw_left(c2, payment_method.upper(), margin + 10, y); y -= line_h + 4
    draw_left(c2, "Date:", margin, y); y -= line_h
    draw_left(c2, str(date), margin + 10, y); y -= line_h + 8

    c2.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_center(c2, "ITEMS", y, size=11)
    y -= (line_h + 4)

    for item in items:
        name = str(item.get("name", ""))
        qty = item.get("quantity", 0)
        price = item.get("unitPrice", 0)
        total_line = item.get("total", qty * price)
        meta = f"{qty} × {price:.2f} AED"
        draw_left(c2, name, margin, y)
        y -= line_h - 2
        draw_left(c2, meta, margin + 4, y)
        draw_right(c2, fmt_amount(total_line), width_pt - margin, y)
        y -= (line_h + 4)

    y -= 2
    c2.line(margin, y, width_pt - margin, y)
    y -= line_h
    draw_left(c2, "Items count:", margin, y)
    draw_right(c2, str(len(items)), width_pt - margin, y)
    y -= line_h
    draw_left(c2, "Subtotal:", margin, y)
    draw_right(c2, fmt_amount(subtotal_val), width_pt - margin, y)
    y -= line_h
    draw_left(c2, "VAT:", margin, y)
    draw_right(c2, fmt_amount(vat_val), width_pt - margin, y)
    y -= line_h
    draw_left(c2, "TOTAL:", margin, y)
    draw_right(c2, fmt_amount(total), width_pt - margin, y)
    y -= line_h
    draw_left(c2, "Paid amount:", margin, y)
    draw_right(c2, fmt_amount(paid_amount), width_pt - margin, y)
    y -= line_h + 10
    draw_center(c2, "Thank you for your purchase!", y, size=10)

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
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/generate-receipt", methods=["POST", "OPTIONS"])
def generate_receipt():
    if request.method == "OPTIONS":
        resp = make_response("")
        resp.status_code = 204
        return resp

    try:
        data = request.get_json(force=True) or {}

        # Mode selection: default to printing instantly
        mode = str(data.get("mode") or request.args.get("mode") or "print").lower()

        if mode == "pdf":
            pdf = build_receipt_pdf(data)
            receipt_no = data.get("receiptNo", "noid")
            date_str = datetime.now().strftime("%Y%m%d")
            filename = f"receipt_{receipt_no}_{date_str}.pdf"

            resp = make_response(pdf)
            resp.headers["Content-Type"] = "application/pdf"
            resp.headers["Content-Disposition"] = f"inline; filename={filename}"
            resp.headers["Content-Length"] = str(len(pdf))
            return resp

        # ESC/POS print path
        print_receipt_escpos(data)
        return jsonify({"printed": True}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ===== GOOGLE CALENDAR OAUTH =====
# Read server-side credentials from environment. Do NOT expose in frontend.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_AUTH_URI = os.environ.get("GOOGLE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth")
GOOGLE_TOKEN_URI = os.environ.get("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5001/api/google/oauth/callback")
GOOGLE_SCOPE = os.environ.get("GOOGLE_CALENDAR_SCOPE", "https://www.googleapis.com/auth/calendar.events")


@app.route("/api/google/oauth/start", methods=["GET"])  # redirect user to Google consent screen
def google_oauth_start():
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Missing GOOGLE_CLIENT_ID on server"}), 500
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "scope": GOOGLE_SCOPE,
    }
    url = f"{GOOGLE_AUTH_URI}?{urllib.parse.urlencode(params)}"
    return redirect(url, code=302)


@app.route("/api/google/oauth/callback", methods=["GET"])  # handle Google OAuth redirect
def google_oauth_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        return jsonify({"error": "Server missing Google OAuth credentials"}), 500

    try:
        data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        resp = requests.post(GOOGLE_TOKEN_URI, data=data, timeout=20)
        if resp.status_code != 200:
            return jsonify({"error": "Token exchange failed", "details": resp.text}), 400
        token_payload = resp.json()

        # Persist tokens locally for now (dev). In production, store in a secure DB.
        os.makedirs(".secrets", exist_ok=True)
        with open(".secrets/google_calendar_tokens.json", "w") as f:
            json.dump(token_payload, f)

        # Simple confirmation page
        html = (
            "<html><body>"
            "<h3>Google Calendar connected.</h3>"
            "<p>You can close this tab and return to the app.</p>"
            "</body></html>"
        )
        response = make_response(html)
        response.headers["Content-Type"] = "text/html"
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port)
