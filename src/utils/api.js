export async function generateReceipt(data) {
  const mode = (data && data.mode) ? String(data.mode).toLowerCase() : 'print';
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? import.meta.env.VITE_API_BASE_URL : 'http://localhost:5001';
  const endpoint = `${base}/api/generate-receipt${mode === 'pdf' ? '?mode=pdf' : ''}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to generate receipt: ${res.status} ${errText}`);
  }

  // If server returned PDF, open preview in a new tab
  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url);
    return url;
  }

  // Print mode returns JSON (do not open a browser tab)
  try {
    const json = await res.json();
    return json; // e.g., { printed: true }
  } catch (_) {
    // Fallback in case content-type is not JSON
    return { ok: true };
  }
}