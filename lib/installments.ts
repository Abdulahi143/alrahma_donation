export function installmentError(input: unknown, today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })) {
  if (!input || typeof input !== 'object') return 'Kontrollera betalningsuppgifterna.';
  const b = input as Record<string, unknown>;
  if (!Number.isInteger(b.amountSek) || Number(b.amountSek) < 1 || Number(b.amountSek) > 10000000) return 'Ange ett belopp i hela kronor mellan 1 och 10 000 000.';
  if (!['swish', 'bank_transfer', 'cash', 'card'].includes(String(b.method))) return 'Välj betalningsmetod.';
  if (typeof b.paidOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.paidOn) || Number.isNaN(Date.parse(b.paidOn)) || new Date(b.paidOn).toISOString().slice(0, 10) !== b.paidOn || b.paidOn > today) return 'Ange ett giltigt betalningsdatum som inte ligger i framtiden.';
  if (b.verified !== true) return 'Bekräfta att du har kontrollerat den mottagna betalningen.';
  if (typeof b.requestId !== 'string' || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(b.requestId)) return 'Ladda om sidan och försök igen.';
  return null;
}
