import { Donation, Donor, PaymentPlan } from './types';

export const paymentMethods: Record<string, string> = { swish: 'Swish', bank_transfer: 'Banköverföring', cash: 'Kontant', card: 'Kort' };
export function planProgress(plan: PaymentPlan, donations: Donation[]) {
  const paid = donations.filter(d => d.payment_plan_id === plan.id && d.status === 'confirmed').reduce((sum, d) => sum + d.amount_sek, 0);
  const count = plan.amount_per_month_sek > 0 ? Math.min(plan.months, Math.floor(paid / plan.amount_per_month_sek)) : 0;
  return `${count}|${plan.months}`;
}
export function notificationChoices(donor: Donor) {
  return donor.comm_opt_out ? 'Inga aviseringar' : [donor.comm_email && 'E-post', donor.comm_sms && 'SMS', donor.comm_whatsapp && 'WhatsApp'].filter(Boolean).join(', ') || 'Inga aviseringar';
}
export function donorSummary(id: string, donations: Donation[], plans: PaymentPlan[]) {
  const donorPlans = plans.filter(p => p.donor_id === id);
  const planIds = new Set(donorPlans.map(p => p.id));
  const payments = donations.filter(d => d.donor_id === id || (d.payment_plan_id && planIds.has(d.payment_plan_id)));
  const sum = (rows: Donation[]) => rows.reduce((total, d) => total + d.amount_sek, 0);
  const confirmed = payments.filter(d => d.status === 'confirmed');
  // Installments belong to their plan: never count both pledge and installment as promised.
  const standalone = payments.filter(d => !d.payment_plan_id || !planIds.has(d.payment_plan_id));
  let pledged = sum(standalone.filter(d => d.status !== 'rejected'));
  let remaining = sum(standalone.filter(d => d.status === 'pending'));
  for (const plan of donorPlans) {
    const paid = sum(confirmed.filter(d => d.payment_plan_id === plan.id));
    pledged += plan.status === 'cancelled' ? paid : Math.max(plan.total_amount_sek, paid);
    if (plan.status !== 'cancelled') remaining += Math.max(0, plan.total_amount_sek - paid);
  }
  return {
    pledged, paid: sum(confirmed), remaining, payments, plans: donorPlans,
    methods: [...new Set([...payments.map(d => d.method), ...donorPlans.map(p => p.method).filter((m): m is NonNullable<typeof m> => !!m)])].map(m => paymentMethods[m] || m).join(', ') || '—'
  };
}
