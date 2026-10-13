'use client';

import { supabaseBrowser } from '@/lib/supabase/client';

export default function NotAdmin({ id, email }: { id: string; email: string }) {
  const sql = `insert into admins (user_id, full_name)\nvalues ('${id}', 'Admin')\non conflict do nothing;`;
  const logout = async () => {
    await supabaseBrowser.auth.signOut();
    window.location.href = '/admin/login';
  };
  return (
    <div className="grid min-h-screen place-items-center bg-mosque-cream p-4 text-mosque-ink">
      <div className="w-full max-w-lg rounded-2xl border border-mosque-ink/10 bg-white p-6">
        <h1 className="text-xl font-extrabold">Inloggningen fungerade, men du är inte admin</h1>
        <p className="mt-2 text-sm text-mosque-ink/70">
          Du är inloggad som <b>{email}</b>, men det här kontot finns inte i tabellen <code>admins</code>. Lägg till det i Supabase (SQL Editor):
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-mosque-ink p-3 text-xs text-white">{sql}</pre>
        <p className="mt-3 text-xs text-mosque-ink/60">Ladda sedan om sidan. Om det inte hjälper: kontrollera att tabellen <code>admins</code> finns (kör supabase/admins.sql) och att NEXT_PUBLIC_SUPABASE_URL pekar på samma projekt.</p>
        <button onClick={logout} className="mt-4 rounded-lg bg-mosque-ink/10 px-4 py-2 text-sm font-bold">Logga ut</button>
      </div>
    </div>
  );
}
