import { recipientAddress } from './communication';

export type BroadcastRecipient = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_language: string;
  comm_email: boolean;
  comm_sms: boolean;
  comm_whatsapp: boolean;
  comm_opt_out: boolean;
};

export type Profile = { id: string; full_name: string; phone: string | null; email: string | null; anonymized_at?: string | null };
export type Consent = { id: string; donor_id: string; purpose: string; granted: boolean; created_at: string };

export function profileRecipients(profiles: Profile[], consents: Consent[]): BroadcastRecipient[] {
  const latest = new Map<string, boolean>();
  for (const row of [...consents].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    const key = `${row.donor_id}:${row.purpose}`;
    if (!latest.has(key)) latest.set(key, row.granted);
  }
  return profiles.filter(p => !p.anonymized_at && latest.get(`${p.id}:storage`) === true).map(p => ({
    id: `profile:${p.id}`, full_name: p.full_name, phone: p.phone, email: p.email || '', preferred_language: 'sv',
    comm_sms: latest.get(`${p.id}:contact_sms`) === true,
    comm_email: latest.get(`${p.id}:contact_email`) === true,
    comm_whatsapp: false, comm_opt_out: false
  }));
}

export function suppressOptedOutPhones(recipients: BroadcastRecipient[]): BroadcastRecipient[] {
  const blocked = new Set(recipients.filter(r => r.comm_opt_out || (r.id.startsWith('profile:') && !r.comm_sms))
    .map(r => recipientAddress({ ...r, comm_opt_out: false, comm_sms: true }, 'sms')).filter(Boolean));
  return recipients.map(r => blocked.has(recipientAddress({ ...r, comm_opt_out: false, comm_sms: true }, 'sms')) ? { ...r, comm_sms: false } : r);
}
