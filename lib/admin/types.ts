export type CampaignStatus = 'draft' | 'published' | 'paused' | 'ended';
export type FundType = 'sadaqah' | 'zakat' | 'building' | 'other';

export interface Campaign {
  id: string;
  title: string;
  slug: string;
  short_text: string;
  long_text: string;
  image_url: string;
  goal_sek: number;
  starts_on: string | null;
  ends_on: string | null;
  fund_type: FundType;
  pledges_count_public: boolean;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  campaign_id: string;
  confirmed_sek: number;
  gifts: number;
  donors: number;
  pledged_outstanding_sek: number;
}
