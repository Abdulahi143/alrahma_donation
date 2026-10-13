export const METHOD_SV: Record<string, string> = {
  swish: 'Swish',
  card: 'Kort',
  paypal: 'PayPal',
  cash: 'Kontant',
  bank_transfer: 'Banköverföring',
  import: 'Import'
};

export const TX_STATUS_SV: Record<string, string> = {
  confirmed: 'Bekräftad',
  awaiting_approval: 'Väntar på godkännande',
  pending_provider: 'Väntar på betalleverantör',
  rejected: 'Avvisad',
  refunded: 'Återbetald'
};

export const CAMPAIGN_STATUS_SV: Record<string, string> = {
  draft: 'Utkast',
  published: 'Publicerad',
  paused: 'Pausad',
  ended: 'Avslutad'
};

export const FUND_SV: Record<string, string> = {
  sadaqah: 'Sadaqah',
  zakat: 'Zakat',
  building: 'Byggfond',
  other: 'Övrigt'
};
