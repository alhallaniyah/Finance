import { supabaseHelpers } from './supabaseHelpers';

export async function generateDocumentNumber(type: 'quotation' | 'invoice' | 'delivery_note'): Promise<string> {
  const prefix = type === 'quotation' ? 'QUO' : type === 'invoice' ? 'INV' : 'DN';
  const year = new Date().getFullYear();

  try {
    const documents = await supabaseHelpers.getDocuments();
    const filteredDocs = documents
      .filter(doc => doc.document_type === type && doc.document_number.startsWith(`${prefix}-${year}-`))
      .sort((a, b) => b.document_number.localeCompare(a.document_number));

    let nextNumber = 1;
    if (filteredDocs.length > 0) {
      const lastNumber = parseInt(filteredDocs[0].document_number.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${year}-${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating document number:', error);
    return `${prefix}-${year}-001`;
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
