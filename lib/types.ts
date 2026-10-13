export type Lang = 'en' | 'sv' | 'ar';

export type CommPref = 'email' | 'sms' | 'whatsapp' | 'none';

export interface Donor {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_language: Lang;
  comm_email: boolean;
  comm_sms: boolean;
  comm_whatsapp: boolean;
  comm_opt_out: boolean;
  gdpr_consent: boolean;
  gdpr_consent_at: string | null;
  created_at: string;
}

export interface Donation {
  id: string;
  donor_id: string | null;
  display_name: string;
  amount_sek: number;
  method: 'cash' | 'swish' | 'card' | 'bank_transfer';
  status: 'pending' | 'confirmed' | 'rejected';
  message: string | null;
  is_anonymous: boolean;
  payment_plan_id: string | null;
  created_at: string;
}

export interface PaymentPlan {
  id: string;
  donor_id: string | null;
  display_name: string;
  total_amount_sek: number;
  months: 2 | 6 | 12;
  amount_per_month_sek: number;
  installments_paid: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface TransparencyFile {
  label: string;
  url: string;
}

export interface CampaignSettings {
  id: string;
  swish_number: string;
  bankgiro: string;
  iban: string;
  paypal_link: string;
  paypal_placeholder: boolean;
  plusgiro: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  bic: string;
  card_link: string;
  swish_qr_url: string;
  paypal_qr_url: string;
  is_live: boolean;
  paused_message: string;
  transparency_files: TransparencyFile[];
  updated_at: string;
  // joined from campaign_totals by /api/admin/settings
  goal_sek?: number;
}

export interface BroadcastLogEntry {
  id: string;
  channel: 'sms' | 'email';
  recipient_count: number;
  message: string;
  simulated: boolean;
  created_at: string;
}
