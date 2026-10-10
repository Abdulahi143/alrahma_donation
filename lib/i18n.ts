import { Lang } from './types';

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    mosqueName: 'Al-Rahma Mosque',
    raisedLabel: 'Raised so far',
    goalLabel: 'Goal',
    liveFeed: 'Live donations',
    registerTitle: 'Become a supporter',
    registerSubtitle: 'Register to give once or set up a monthly plan',
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    amount: 'Amount (SEK)',
    plan: 'Giving plan',
    oneTime: 'One-time',
    monthly: 'Monthly plan',
    communication: 'How should we contact you?',
    gdprText: 'I agree that Al-Rahma Mosque may store my details to process this donation, in line with GDPR.',
    privacyLink: 'Privacy policy',
    submit: 'Register & continue',
    thankYou: 'Thank you! We’ve received your registration.'
  },
  sv: {
    mosqueName: 'Al-Rahma Moské',
    raisedLabel: 'Insamlat hittills',
    goalLabel: 'Mål',
    liveFeed: 'Livedonationer',
    registerTitle: 'Bli givare',
    registerSubtitle: 'Registrera dig för en engångsgåva eller en månadsplan',
    fullName: 'Fullständigt namn',
    email: 'E-post',
    phone: 'Telefon',
    amount: 'Belopp (SEK)',
    plan: 'Givarplan',
    oneTime: 'Engångsbelopp',
    monthly: 'Månadsplan',
    communication: 'Hur vill du bli kontaktad?',
    gdprText: 'Jag godkänner att Al-Rahma Moské lagrar mina uppgifter, i enlighet med GDPR.',
    privacyLink: 'Integritetspolicy',
    submit: 'Registrera och fortsätt',
    thankYou: 'Tack! Vi har tagit emot din registrering.'
  },
  ar: {
    mosqueName: 'مسجد الرحمة',
    raisedLabel: 'تم جمعه',
    goalLabel: 'الهدف',
    liveFeed: 'التبرعات المباشرة',
    registerTitle: 'كن داعمًا',
    registerSubtitle: 'سجّل للتبرع لمرة واحدة أو خطة شهرية',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    amount: 'المبلغ (كرونة سويدية)',
    plan: 'خطة التبرع',
    oneTime: 'مرة واحدة',
    monthly: 'خطة شهرية',
    communication: 'كيف تفضل أن نتواصل معك؟',
    gdprText: 'أوافق على أن يقوم مسجد الرحمة بتخزين بياناتي، وفقًا لـ GDPR.',
    privacyLink: 'سياسة الخصوصية',
    submit: 'سجّل وتابع',
    thankYou: 'شكرًا لك! تم استلام تسجيلك.'
  }
};

export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
