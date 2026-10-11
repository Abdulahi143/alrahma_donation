export type Channel = 'sms' | 'email' | 'whatsapp';
type Contact = { email: string; phone: string | null; comm_email: boolean; comm_sms: boolean; comm_whatsapp: boolean; comm_opt_out: boolean };

export function recipientAddress(donor: Contact, channel: Channel): string | null {
  if (donor.comm_opt_out || !donor[`comm_${channel}`]) return null;
  if (channel === 'email') return donor.email.trim().toLowerCase() || null;
  const phone = donor.phone?.replace(/[\s()-]/g, '').replace(/^00/, '+');
  return phone && /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
