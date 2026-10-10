'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const login = async () => {
    setError(null);
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    router.push('/admin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mosque-cream">
      <div className="w-full max-w-sm rounded-2xl border border-mosque-ink/10 bg-white p-8">
        <div className="mb-6 text-xl font-extrabold text-mosque-ink">Logga in som admin</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-post"
          className="mb-3 w-full rounded-lg border border-mosque-ink/15 px-3.5 py-2.5 text-sm"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Lösenord"
          className="mb-4 w-full rounded-lg border border-mosque-ink/15 px-3.5 py-2.5 text-sm"
        />
        {error && <div className="mb-3 text-sm font-semibold text-red-600">{error}</div>}
        <button
          onClick={login}
          className="w-full rounded-lg bg-mosque-emerald py-2.5 font-bold text-white"
        >
          Logga in
        </button>
      </div>
    </div>
  );
}
