'use client';

import { useState } from 'react';
import { Lang, TransparencyFile } from '@/lib/types';
import { t } from '@/lib/i18n';
import LanguageDropdown from '@/components/LanguageDropdown';
import RegisterForm from '@/components/RegisterForm';

export default function SupporterClient({
  initialLang,
  transparencyFiles
}: {
  initialLang: Lang;
  transparencyFiles: TransparencyFile[];
}) {
  const [lang, setLang] = useState<Lang>(initialLang);

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen w-full bg-[radial-gradient(circle_at_50%_-10%,#1a3c21_0%,#0e2a14_55%,#081a0c_100%)] px-4 pb-12 pt-8 text-mosque-cream sm:px-8"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3.5">
            <img src="/logo.png" alt="Masjid Al-Rahma" className="h-14 w-14 flex-shrink-0" />
            <div className="text-xl font-extrabold">{t(lang, 'mosqueName')}</div>
          </a>
          <LanguageDropdown lang={lang} onChange={setLang} />
        </div>

        <a href="/" className="text-sm font-semibold text-mosque-mint/80 hover:text-mosque-mint">
          {t(lang, 'backHome')}
        </a>

        <RegisterForm lang={lang} transparencyFiles={transparencyFiles} />
      </div>
    </div>
  );
}
