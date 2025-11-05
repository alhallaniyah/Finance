import { supabaseHelpers } from './supabaseHelpers';

export async function generateDocumentNumber(type: 'quotation' | 'invoice' | 'delivery_note'): Promise<string> {
  const prefix = type === 'quotation' ? 'q' : type === 'invoice' ? 'r' : 'd';
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  try {
    const documents = await supabaseHelpers.getDocuments();
    const filteredDocs = documents
      .filter(
        (doc) =>
          doc.document_type === type &&
          doc.document_number &&
          doc.document_number.startsWith(`${prefix}-${dateStr}`) &&
          /^\d+$/.test(doc.document_number.slice(`${prefix}-${dateStr}`.length))
      )
      .sort((a, b) => b.document_number.localeCompare(a.document_number));

    let nextNumber = 1;
    if (filteredDocs.length > 0) {
      const suffix = filteredDocs[0].document_number.slice(`${prefix}-${dateStr}`.length);
      const lastNumber = parseInt(suffix, 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${dateStr}${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating document number:', error);
    return `${prefix}-${dateStr}001`;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
