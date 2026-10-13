import { Lang } from './types';

const messages = {
  en: { fullName: 'Enter your full name (1–120 characters).', email: 'Enter a valid email address, such as name@example.com.', phone: 'Enter a valid phone number for SMS or WhatsApp, such as +46 70 123 45 67.', amount: 'Enter a whole SEK amount between 1 and 10,000,000.', months: 'Choose a plan of 2, 6, or 12 months.', consent: 'Check the privacy consent box to register your donation.', publicConsent: 'Consent to publish your selected name, or choose Anonymous.', displayName: 'Enter a display name (1–80 characters).', options: 'Check your payment method, language, and notification choices.', monthly: 'Your total pledge of {amount} SEK cannot be split evenly over {months} months. Enter a multiple of {months}, such as {suggestion} SEK, or choose a different plan.' },
  sv: { fullName: 'Ange ditt fullständiga namn (1–120 tecken).', email: 'Ange en giltig e-postadress, till exempel namn@example.com.', phone: 'Ange ett giltigt telefonnummer för SMS eller WhatsApp, till exempel +46 70 123 45 67.', amount: 'Ange ett belopp i hela kronor mellan 1 och 10 000 000.', months: 'Välj en plan på 2, 6 eller 12 månader.', consent: 'Markera samtycket för behandling av personuppgifter för att registrera donationen.', publicConsent: 'Samtyck till att publicera ditt valda namn eller välj Anonym.', displayName: 'Ange ett visningsnamn (1–80 tecken).', options: 'Kontrollera betalningsmetod, språk och val av aviseringar.', monthly: 'Ditt totala löfte på {amount} kr kan inte delas jämnt över {months} månader. Ange en multipel av {months}, till exempel {suggestion} kr, eller välj en annan plan.' },
  ar: { fullName: 'أدخل اسمك الكامل (من 1 إلى 120 حرفًا).', email: 'أدخل بريدًا إلكترونيًا صالحًا مثل name@example.com.', phone: 'أدخل رقم هاتف صالحًا للرسائل أو واتساب مثل +46 70 123 45 67.', amount: 'أدخل مبلغًا صحيحًا بالكرونة بين 1 و10,000,000.', months: 'اختر خطة لمدة شهرين أو 6 أو 12 شهرًا.', consent: 'وافق على معالجة بياناتك لتسجيل التبرع.', publicConsent: 'وافق على نشر الاسم المختار أو اختر مجهول.', displayName: 'أدخل اسم العرض (من 1 إلى 80 حرفًا).', options: 'تحقق من طريقة الدفع واللغة وخيارات الإشعارات.', monthly: 'لا يمكن تقسيم تعهدك البالغ {amount} كرونة بالتساوي على {months} شهرًا. أدخل مضاعفًا لـ {months} مثل {suggestion} كرونة أو اختر خطة أخرى.' }
};
export type RegistrationIssue = { field: string; code: keyof typeof messages.en; amount?: number; months?: number; suggestion?: number };
export function issueText(issue: RegistrationIssue, lang: Lang) {
  return messages[lang][issue.code].replace(/\{(amount|months|suggestion)\}/g, (_, key: 'amount' | 'months' | 'suggestion') => String(issue[key]));
}
export function registrationIssues(input: unknown): RegistrationIssue[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [{ field: 'form', code: 'options' }];
  const b = input as Record<string, any>;
  const issues: RegistrationIssue[] = [];
  const add = (field: string, code: RegistrationIssue['code']) => issues.push({ field, code });
  if (typeof b.fullName !== 'string' || !b.fullName.trim() || b.fullName.length > 120) add('fullName', 'fullName');
  if (typeof b.email !== 'string' || b.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) add('email', 'email');
  if (typeof b.phone !== 'string' || b.phone.length > 30 || ((b.comms?.sms || b.comms?.whatsapp) && !/^\+?[\d\s()-]{6,30}$/.test(b.phone.trim()))) add('phone', 'phone');
  const validAmount = Number.isInteger(b.amountSek) && b.amountSek >= 1 && b.amountSek <= 10000000;
  if (!validAmount) add('amountSek', 'amount');
  if (!['en', 'sv', 'ar'].includes(b.preferredLanguage) || !['onetime', 'monthly'].includes(b.frequency) || !['swish', 'bank_transfer'].includes(b.paymentMethod) || !b.comms || ['email', 'sms', 'whatsapp', 'none'].some(k => typeof b.comms[k] !== 'boolean') || (b.comms.none && (b.comms.email || b.comms.sms || b.comms.whatsapp)) || !['anonymous', 'entered', 'custom'].includes(b.displayMode) || typeof b.publicDisplayConsent !== 'boolean') add('form', 'options');
  if (b.gdprConsent !== true) add('gdprConsent', 'consent');
  if (b.frequency === 'monthly') {
    if (![2, 6, 12].includes(b.months)) add('months', 'months');
    else if (validAmount && b.amountSek % b.months !== 0) issues.push({ field: 'amountSek', code: 'monthly', amount: b.amountSek, months: b.months, suggestion: Math.max(b.months, Math.floor(b.amountSek / b.months) * b.months) });
  }
  if (['entered', 'custom'].includes(b.displayMode) && b.publicDisplayConsent !== true) add('publicDisplayConsent', 'publicConsent');
  if (b.displayMode === 'custom' && (typeof b.displayName !== 'string' || !b.displayName.trim() || b.displayName.trim().length > 80)) add('displayName', 'displayName');
  return issues;
}
