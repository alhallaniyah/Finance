// Lightweight POS receipt builder that mimics the BIXOLON sample commands
// and avoids the Python API. This prepares ESC/POS commands (as JSON)
// compatible with the Web Print SDK and falls back to a simple HTML preview.

const RECEIPT_WIDTH = 42; // characters for a ~3 inch roll

function getDefaultPrinterName() {
  try {
    const saved = localStorage.getItem('pos.printerName');
    if (saved) return saved;
  } catch (_) {
    /* no-op */
  }
  const envName = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BIXOLON_PRINTER) || null;
  return envName || 'Printer1';
}

function formatAmount(val) {
  const num = Number(val);
  if (Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
}

function centerText(text) {
  if (!text) return '';
  if (text.length >= RECEIPT_WIDTH) return text;
  const padding = Math.floor((RECEIPT_WIDTH - text.length) / 2);
  return ' '.repeat(padding) + text;
}

function kvLine(label, value) {
  const left = String(label || '');
  const right = String(value || '');
  const space = RECEIPT_WIDTH - left.length - right.length;
  if (space < 1) return `${left}\n${right}`;
  return `${left}${' '.repeat(space)}${right}`;
}

function divider() {
  return '-'.repeat(RECEIPT_WIDTH);
}

class PosCommandBuilder {
  constructor() {
    this.posData = { id: Date.now(), functions: {} };
    this.inc = 0;
  }

  setId(id) {
    this.posData.id = id;
  }

  add(name, args) {
    this.posData.functions[`func${this.inc}`] = { [name]: args };
    this.inc += 1;
  }

  checkStatus() {
    this.add('checkPrinterStatus', []);
  }

  text(text, { bold = false, align = 0 } = {}) {
    this.add('printText', [text, 0, 0, bold, false, false, 0, align]);
  }

  cut(feed = 1) {
    this.add('cutPaper', [feed]);
  }

  toJSON() {
    return JSON.stringify(this.posData);
  }
}

function buildReceiptLayout(payload) {
  const lines = [];
  lines.push(centerText(payload.companyName || 'Company'));
  if (payload.companyAddress) lines.push(centerText(payload.companyAddress));
  if (payload.companyPhone) lines.push(centerText(payload.companyPhone));
  lines.push(divider());
  lines.push(kvLine('Receipt No', payload.receiptNo || '-'));
  if (payload.paymentMethod) lines.push(kvLine('Payment', String(payload.paymentMethod).toUpperCase()));
  if (payload.date) lines.push(kvLine('Date', payload.date));
  lines.push(divider());
  lines.push('ITEMS');

  (payload.items || []).forEach((item) => {
    const name = item.name || '';
    const qty = Number(item.quantity) || 0;
    const unit = formatAmount(item.unitPrice || 0);
    const total = formatAmount(item.total || qty * (item.unitPrice || 0));
    lines.push(name.length > RECEIPT_WIDTH ? name.slice(0, RECEIPT_WIDTH) : name);
    lines.push(kvLine(` ${qty} x ${unit}`, `${total}`));
  });

  lines.push(divider());
  if (typeof payload.subtotal === 'number') lines.push(kvLine('Subtotal', formatAmount(payload.subtotal)));
  if (typeof payload.vat === 'number') lines.push(kvLine('VAT', formatAmount(payload.vat)));
  lines.push(kvLine('TOTAL', formatAmount(payload.total)));
  lines.push(kvLine('Paid amount', formatAmount(payload.paidAmount)));
  lines.push('');
  lines.push(centerText('Thank you for your purchase!'));
  return lines;
}

function buildPosCommands(payload) {
  const builder = new PosCommandBuilder();
  builder.setId(Date.now());
  builder.checkStatus();
  const lines = buildReceiptLayout(payload);
  lines.forEach((line, idx) => {
    const isHeader = idx === 0;
    const align = idx <= 2 ? 1 : 0; // center header, left body
    builder.text(`${line}\n`, { bold: isHeader, align });
  });
  builder.cut(1);
  return { commands: builder.toJSON(), lines };
}

function openPreview(lines) {
  try {
    const html = `<!doctype html><html><head><title>Receipt Preview</title></head><body><pre style="font-family: 'Fira Code', monospace; font-size: 12px; line-height: 1.35;">${lines.join('\n')}</pre><script>setTimeout(()=>window.print(), 100);</script></body></html>`;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  } catch (e) {
    console.warn('Preview open failed', e);
  }
}

export async function generateReceipt(data) {
  const mode = (data && data.mode) ? String(data.mode).toLowerCase() : 'print';
  const { commands, lines } = buildPosCommands(data || {});
  const printerName = getDefaultPrinterName();
  const requester = typeof window !== 'undefined' ? window.requestPrint : null;

  // If BIXOLON Web Print SDK is available, use it
  if (typeof requester === 'function') {
    return await new Promise((resolve, reject) => {
      try {
        requester(printerName, commands, (result) => resolve(result || { printed: true }));
      } catch (err) {
        reject(err);
      }
    });
  }

  // No SDK available: fallback to HTML preview/print
  if (mode === 'pdf') {
    openPreview(lines);
    return 'preview-opened';
  }
  openPreview(lines);
  return { printed: false, fallback: 'preview-opened' };
}
