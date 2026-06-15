import { supabaseHelpers } from './supabaseHelpers';

export async function generateDocumentNumber(type: 'quotation' | 'invoice' | 'delivery_note'): Promise<string> {
  const prefix = type === 'quotation' ? 'q' : type === 'invoice' ? 'r' : 'd';
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  const todayPrefix = `${prefix}-${dateStr}`;
  try {
    const documents = await supabaseHelpers.getDocumentsByPrefix(todayPrefix, type);
    const filteredDocs = documents
      .filter(
        (doc) =>
          doc.document_number &&
          /^\d+$/.test(doc.document_number.slice(todayPrefix.length))
      )
      .sort((a, b) => b.document_number.localeCompare(a.document_number));

    let nextNumber = 1;
    if (filteredDocs.length > 0) {
      const suffix = filteredDocs[0].document_number.slice(todayPrefix.length);
      const lastNumber = parseInt(suffix, 10);
      nextNumber = lastNumber + 1;
    }

    return `${todayPrefix}${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating document number:', error);
    return `${todayPrefix}001`;
  }
}

export function formatCurrency(amount: number, currency: string = 'AED'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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
