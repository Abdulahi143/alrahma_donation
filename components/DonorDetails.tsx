'use client';
import { useEffect, useRef } from 'react';
import { Donation, Donor, PaymentPlan } from '@/lib/types';
import { donorSummary, notificationChoices, paymentMethods, planProgress } from '@/lib/donors';
import { fmtSEK } from '@/lib/format';

const statusLabels: Record<string, string> = { pending:'Väntande', confirmed:'Bekräftad', rejected:'Avvisad', active:'Aktiv', completed:'Slutförd', cancelled:'Avbruten' };
const date = (value: string) => new Date(value).toLocaleString('sv-SE');
export default function DonorDetails({ donor, donations, plans, onClose }: { donor: Donor; donations: Donation[]; plans: PaymentPlan[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const summary = donorSummary(donor.id, donations, plans);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="donor-detail-title" className="max-h-[90vh] w-[min(960px,95vw)] rounded-2xl p-6 text-mosque-ink backdrop:bg-black/50">
    <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="donor-detail-title" className="text-xl font-bold">{donor.full_name}</h2><p className="text-sm text-mosque-ink/60">Registrerad {date(donor.created_at)}</p></div><button autoFocus onClick={onClose} className="rounded-lg border px-3 py-2">Stäng</button></div>
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Utlovat',summary.pledged],['Bekräftat betalt',summary.paid],['Kvar att betala',summary.remaining]].map(([label,value]) => <div key={label} className="rounded-xl bg-mosque-cream p-4"><p className="text-xs">{label}</p><strong className="text-xl">{fmtSEK(Number(value))}</strong></div>)}</div>
    <p className="mb-5 text-xs text-mosque-ink/60">Betalt räknas från bekräftade betalningsposter. Delbetalningar räknas inom planen. Avbrutna planer och avvisade löften skapar inget återstående belopp.</p>
    <dl className="mb-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {[['E-post',donor.email],['Telefon',donor.phone || '—'],['Betalningsmetoder',summary.methods],['Aviseringar',notificationChoices(donor)],['Språk',donor.preferred_language],['Samtycke för behandling',donor.gdpr_consent ? (donor.gdpr_consent_at ? date(donor.gdpr_consent_at) : 'Givet') : 'Saknas']].map(([label,value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="break-words">{value}</dd></div>)}
    </dl>
    <h3 className="mb-3 font-bold">Donationer och betalningar</h3>
    {!summary.payments.length && <p className="mb-4 text-sm">Inga betalningsposter registrerade.</p>}
    <div className="mb-6 space-y-3">{[...summary.payments].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(payment => <article key={payment.id} className="rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong>{fmtSEK(payment.amount_sek)} · {statusLabels[payment.status]}</strong><span>{paymentMethods[payment.method]} · {date(payment.created_at)}</span></div>
      <p className="mt-2">Offentligt namn: {payment.is_anonymous ? 'Anonym' : payment.display_name}</p>
      <p className="break-all">Referens: {payment.reference || '—'}</p>
      {payment.payment_plan_id && <p>Delbetalning för plan: {summary.plans.find(p => p.id === payment.payment_plan_id)?.reference || payment.payment_plan_id}</p>}
      {payment.confirmed_at && <p>Bekräftad: {date(payment.confirmed_at)}</p>}
    </article>)}</div>
    <h3 className="mb-3 font-bold">Betalningsplaner</h3>
    {!summary.plans.length && <p className="text-sm">Inga betalningsplaner.</p>}
    {summary.plans.map(plan => <article key={plan.id} className="mb-3 rounded-xl border p-4 text-sm"><strong>{fmtSEK(plan.total_amount_sek)} · {statusLabels[plan.status]}</strong><p className="my-2 font-semibold text-mosque-emerald">{planProgress(plan, donations)} månadsbelopp betalda</p><p>{plan.months} månader · {fmtSEK(plan.amount_per_month_sek)} per månad · {paymentMethods[plan.method || ''] || '—'}</p><p>Offentligt namn: {plan.is_anonymous ? 'Anonym' : plan.display_name}</p><p className="break-all">Referens: {plan.reference || '—'}</p></article>)}
  </dialog>;
}

