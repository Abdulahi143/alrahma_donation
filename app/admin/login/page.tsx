'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setError(error.message); return; }
      const response = await fetch('/api/admin/donors');
      if (!response.ok) { setError('Kontot saknar adminåtkomst eller sessionen kunde inte verifieras.'); return; }
      router.replace('/admin');
      router.refresh();
    } catch { setError('Kunde inte ansluta. Försök igen.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mosque-cream">
      <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-mosque-ink/10 bg-white p-8">
        <div className="mb-6 text-xl font-extrabold text-mosque-ink">Logga in som admin</div>
        <input
          type="email"
          autoComplete="username"
          aria-label="E-post"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-post"
          className="mb-3 w-full rounded-lg border border-mosque-ink/15 px-3.5 py-2.5 text-sm"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          aria-label="Lösenord"
          required
          placeholder="Lösenord"
          className="mb-4 w-full rounded-lg border border-mosque-ink/15 px-3.5 py-2.5 text-sm"
        />
        {error && <div role="alert" className="mb-3 text-sm font-semibold text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-mosque-emerald py-2.5 font-bold text-white"
        >
          {loading ? 'Loggar in…' : 'Logga in'}
        </button>
      </form>
    </div>
  );
}
