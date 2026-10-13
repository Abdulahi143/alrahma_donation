import { Lang } from './types';
import { t } from './i18n';
import { registrationIssues } from './registration-errors';

export const formText: Record<Lang, Record<string, string>> = {
  en: {
    displayChoice: 'Name on the public display', anonymous: 'Anonymous', enteredName: 'Use my entered name', customName: 'Choose a display name', displayName: 'Display name', displayHelp: 'Your contact name stays private. Only the selected name and amount appear publicly if you consent.',
    paymentMethod: 'Payment method', bankTransfer: 'Bank transfer',
    displayConsent: 'I explicitly agree to publish my name and pledged amount on the public donation display. This may reveal my association with Al-Rahma Mosque. Optional; otherwise my donation is anonymous.',
    notificationConsent: 'Send me donation updates and reminders through the channels I select. Optional; no fundraising messages.',
    pending: 'Your pledge is recorded. Payment has not been verified. Use this reference with your Swish or bank transfer payment.',
    reference: 'Payment reference', failed: 'Could not register your pledge. Please try again.',
    unavailable: 'Registration is temporarily unavailable. Please try again later.',
    invalid: 'Check your details. Use a whole SEK amount and provide a phone number for SMS or WhatsApp.',
    planTotal: 'For a monthly plan, enter the total pledge. It must divide evenly over the selected months.',
    phoneRequired: 'Phone is required for SMS or WhatsApp.', none: 'No notifications'
  },
  sv: {
    displayChoice: 'Namn som visas offentligt', anonymous: 'Anonym', enteredName: 'Använd mitt angivna namn', customName: 'Välj ett visningsnamn', displayName: 'Visningsnamn', displayHelp: 'Ditt kontaktnamn hålls privat. Bara det valda namnet och beloppet visas offentligt om du samtycker.',
    paymentMethod: 'Betalningsmetod', bankTransfer: 'Banköverföring',
    displayConsent: 'Jag samtycker uttryckligen till att mitt namn och utlovade belopp visas offentligt. Detta kan visa min anknytning till Al-Rahma Moské. Frivilligt; annars visas donationen anonymt.',
    notificationConsent: 'Skicka uppdateringar och påminnelser om donationen via valda kanaler. Frivilligt; inga insamlingsutskick.',
    pending: 'Ditt löfte är registrerat. Betalningen är ännu inte verifierad. Ange denna referens vid betalning med Swish eller banköverföring.',
    reference: 'Betalningsreferens', failed: 'Registreringen misslyckades. Försök igen.',
    unavailable: 'Registreringen är tillfälligt otillgänglig. Försök igen senare.',
    invalid: 'Kontrollera uppgifterna. Ange hela kronor och telefonnummer för SMS eller WhatsApp.',
    planTotal: 'Ange hela löftesbeloppet för en månadsplan. Det ska kunna delas jämnt över valda månader.',
    phoneRequired: 'Telefonnummer krävs för SMS eller WhatsApp.', none: 'Inga meddelanden'
  },
  ar: {
    displayChoice: 'الاسم المعروض علنًا', anonymous: 'مجهول', enteredName: 'استخدام الاسم الذي أدخلته', customName: 'اختيار اسم للعرض', displayName: 'اسم العرض', displayHelp: 'يبقى اسم التواصل خاصًا. لا يظهر علنًا إلا الاسم المختار والمبلغ إذا وافقت.',
    paymentMethod: 'طريقة الدفع', bankTransfer: 'تحويل بنكي',
    displayConsent: 'أوافق صراحة على نشر اسمي ومبلغ تعهدي علنًا. قد يكشف ذلك عن ارتباطي بمسجد الرحمة. اختياري؛ وإلا يُعرض التبرع دون اسم.',
    notificationConsent: 'أرسل تحديثات وتذكيرات التبرع عبر القنوات التي أختارها. اختياري؛ دون رسائل جمع التبرعات.',
    pending: 'تم تسجيل التعهد ولم يتم التحقق من الدفع بعد. استخدم هذا المرجع عند الدفع عبر Swish أو التحويل البنكي.',
    reference: 'مرجع الدفع', failed: 'تعذر تسجيل التعهد. حاول مرة أخرى.',
    unavailable: 'التسجيل غير متاح مؤقتًا. حاول لاحقًا.',
    invalid: 'تحقق من البيانات. أدخل مبلغًا صحيحًا بالكرونة ورقم هاتف للرسائل أو واتساب.',
    planTotal: 'للخطة الشهرية أدخل إجمالي التعهد. يجب أن يقسم بالتساوي على عدد الأشهر المختار.',
    phoneRequired: 'رقم الهاتف مطلوب للرسائل أو واتساب.', none: 'دون إشعارات'
  }
};

export function validateRegistration(input: unknown) {
  if (registrationIssues(input).length) return null;
  const b = input as Record<string, any>;
  const lang = b.preferredLanguage as Lang;
  return {
    fullName: b.fullName.trim(), email: b.email.trim().toLowerCase(), phone: b.phone.trim(),
    amountSek: b.amountSek, preferredLanguage: lang, frequency: b.frequency,
    months: b.frequency === 'monthly' ? b.months : null, paymentMethod: b.paymentMethod,
    gdprConsent: true, publicDisplayConsent: b.displayMode !== 'anonymous' && b.publicDisplayConsent,
    displayName: b.displayMode === 'anonymous' ? 'Anonymous' : b.displayMode === 'entered' ? b.fullName.trim() : b.displayName.trim(),
    comms: { email: b.comms.email, sms: b.comms.sms, whatsapp: b.comms.whatsapp, none: b.comms.none },
    processingConsentText: t(lang, 'gdprText'), displayConsentText: formText[lang].displayConsent,
    notificationConsentText: formText[lang].notificationConsent
  };
}
