import { supabaseAdmin } from './supabase/server';
import { BroadcastRecipient, Consent, Profile, profileRecipients, suppressOptedOutPhones } from './broadcast-recipients';

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function allRows<T>(query: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
  throw new Error('För många givare för ett utskick. Kontakta administratören.');
}

export async function loadBroadcastRecipients(selectedIds?: string[]): Promise<BroadcastRecipient[]> {
  const db = supabaseAdmin();
  const [legacy, profiles] = await Promise.all([
    allRows<BroadcastRecipient>((from, to) => {
      const query = db.from('donors').select('id,full_name,email,phone,preferred_language,comm_email,comm_sms,comm_whatsapp,comm_opt_out').is('deleted_at', null);
      return query.order('created_at', { ascending: false }).range(from, to);
    }),
    allRows<Profile>((from, to) => {
      const query = db.from('donor_profiles').select('id,full_name,email,phone,anonymized_at').is('anonymized_at', null);
      return query.order('created_at', { ascending: false }).range(from, to);
    })
  ]);

  const consents = profiles.length ? await allRows<Consent>((from, to) => {
    const query = db.from('donor_consents').select('id,donor_id,purpose,granted,created_at');
    return query.order('created_at', { ascending: false }).range(from, to);
  }) : [];

  const safe = suppressOptedOutPhones([
    ...legacy.map(d => ({ ...d, id: `legacy:${d.id}` })),
    ...profileRecipients(profiles, consents)
  ]);
  return selectedIds ? safe.filter(r => selectedIds.includes(r.id)) : safe;
}
