'use client';

import { useState } from 'react';

// Small icon button that copies `value` to the clipboard.
export default function CopyButton({ value, label, doneLabel }: { value: string; label: string; doneLabel: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // clipboard blocked (insecure context) — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? doneLabel : label}
      title={done ? doneLabel : label}
      className="flex-shrink-0 rounded-md p-1 text-mosque-mint/70 transition hover:bg-white/10 hover:text-mosque-cream"
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5 9-10" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
      )}
    </button>
  );
}
