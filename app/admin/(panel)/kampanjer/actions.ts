'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { diff, writeAudit } from '@/lib/admin/audit';
import { Campaign } from '@/lib/admin/types';
import { getAdminUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const AUDITED = ['title', 'slug', 'short_text', 'long_text', 'image_url', 'goal_sek', 'starts_on', 'ends_on', 'fund_type', 'pledges_count_public', 'status'] as const;
const MAX_IMAGE = 3 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Skriv en titel.').max(120, 'Titeln är för lång (max 120 tecken).'),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Webbadressen får bara innehålla a–z, siffror och bindestreck.').or(z.literal('')),
  short_text: z.string().trim().max(240, 'Kort text får vara högst 240 tecken.'),
  long_text: z.string().trim().max(8000),
  goal_sek: z.coerce.number({ error: 'Ange målet i hela kronor.' }).int('Ange målet i hela kronor.').positive('Målet måste vara större än 0 kr.').max(1_000_000_000),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  fund_type: z.enum(['sadaqah', 'zakat', 'building', 'other']),
  pledges_count_public: z.boolean(),
  status: z.enum(['draft', 'published', 'paused', 'ended'])
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function saveCampaign(fd: FormData): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: 'Du är inte inloggad som admin.' };

  const parsed = schema.safeParse({
    id: (fd.get('id') as string) || undefined,
    title: fd.get('title') ?? '',
    slug: fd.get('slug') ?? '',
    short_text: fd.get('short_text') ?? '',
    long_text: fd.get('long_text') ?? '',
    goal_sek: fd.get('goal_sek'),
    starts_on: fd.get('starts_on') ?? '',
    ends_on: fd.get('ends_on') ?? '',
    fund_type: fd.get('fund_type'),
    pledges_count_public: fd.get('pledges_count_public') === 'on',
    status: fd.get('status')
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) return { ok: false, error: 'Slutdatum kan inte vara före startdatum.' };
  if (v.status === 'published' && !v.short_text) return { ok: false, error: 'Skriv en kort text innan du publicerar.' };

  const db = supabaseAdmin();
  let before: Campaign | null = null;
  if (v.id) {
    const { data } = await db.from('campaigns').select('*').eq('id', v.id).single();
    if (!data) return { ok: false, error: 'Kampanjen finns inte längre.' };
    before = data as Campaign;
  }

  const slug = v.slug || slugify(v.title);
  if (!slug) return { ok: false, error: 'Kunde inte skapa en webbadress av titeln. Fyll i den själv.' };

  let image_url = before?.image_url ?? '';
  if (fd.get('remove_image') === '1') image_url = '';
  const file = fd.get('image');
  if (file instanceof File && file.size > 0) {
    const ext = IMAGE_EXT[file.type];
    if (!ext) return { ok: false, error: 'Bilden måste vara JPG, PNG eller WebP.' };
    if (file.size > MAX_IMAGE) return { ok: false, error: 'Bilden är för stor (max 3 MB).' };
    const path = `${slug}-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('campaign-images').upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false, error: `Bilden kunde inte laddas upp: ${upErr.message}` };
    image_url = db.storage.from('campaign-images').getPublicUrl(path).data.publicUrl;
  }

  const row = {
    title: v.title,
    slug,
    short_text: v.short_text,
    long_text: v.long_text,
    image_url,
    goal_sek: v.goal_sek,
    starts_on: v.starts_on || null,
    ends_on: v.ends_on || null,
    fund_type: v.fund_type,
    pledges_count_public: v.pledges_count_public,
    status: v.status,
    updated_at: new Date().toISOString()
  };

  const q = v.id ? db.from('campaigns').update(row).eq('id', v.id) : db.from('campaigns').insert(row);
  const { data: saved, error } = await q.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Webbadressen används redan av en annan kampanj. Välj en annan.' };
    return { ok: false, error: error.message };
  }

  await writeAudit({
    user,
    action: v.id ? 'campaign.update' : 'campaign.create',
    objectType: 'campaign',
    objectId: saved.id,
    objectLabel: saved.title,
    changes: diff(before as unknown as Record<string, unknown> | null, row as Record<string, unknown>, [...AUDITED])
  });

  revalidatePath('/');
  revalidatePath('/admin/kampanjer');
  revalidatePath('/admin');
  return { ok: true, id: saved.id };
}

// Only campaigns with no transactions or pledges can be removed; the rest
// are ended or hidden. The database enforces this too (on delete restrict).
export async function deleteCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: 'Du är inte inloggad som admin.' };

  const db = supabaseAdmin();
  const [{ count: tx }, { count: pl }, { data: c }] = await Promise.all([
    db.from('transactions').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    db.from('pledges').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    db.from('campaigns').select('title').eq('id', id).single()
  ]);
  if (!c) return { ok: false, error: 'Kampanjen finns inte längre.' };
  if ((tx ?? 0) > 0 || (pl ?? 0) > 0) return { ok: false, error: 'Kampanjen har transaktioner eller löften och kan inte tas bort. Avsluta eller dölj den i stället.' };

  const { error } = await db.from('campaigns').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  await writeAudit({ user, action: 'campaign.delete', objectType: 'campaign', objectId: id, objectLabel: c.title });
  revalidatePath('/');
  revalidatePath('/admin/kampanjer');
  return { ok: true };
}
