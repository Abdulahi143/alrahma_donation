'use client';

import { useState } from 'react';
import { Lang } from '@/lib/types';

const LABELS: Record<Lang, string> = { en: 'English', sv: 'Svenska', ar: 'العربية' };

export default function LanguageDropdown({
  lang,
  onChange
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-bold text-mosque-cream"
      >
        <span className="text-base">🌐</span>
        {lang.toUpperCase()}
        <span className="text-[10px] opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[160px] overflow-hidden rounded-lg border border-white/15 bg-mosque-forest shadow-xl">
          {(Object.keys(LABELS) as Lang[]).map((code) => (
            <button
              key={code}
              onClick={() => {
                onChange(code);
                setOpen(false);
              }}
              className={`block w-full px-3.5 py-2.5 text-left text-sm font-semibold ${
                code === lang ? 'bg-mosque-gold/90 text-mosque-deep' : 'text-mosque-cream/90'
              }`}
            >
              {LABELS[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
