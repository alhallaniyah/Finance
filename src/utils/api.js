export async function generateReceipt(data) {
  const res = await fetch("http://localhost:5001/api/generate-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to generate receipt: ${res.status} ${text}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  window.open(url);
  return url;
}