'use client';

import { useEffect, useState } from 'react';
import BroadcastPanel from '@/components/BroadcastPanel';
import { Donor } from '@/lib/types';

export default function Page() {
  const [donors, setDonors] = useState<Donor[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/donors')
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Kunde inte läsa givare.');
        setDonors(data.donors || []);
      })
      .catch(() => setError('Kunde inte läsa givare. Försök ladda om sidan.'));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!donors) return <p>Läser givare…</p>;
  return <BroadcastPanel donors={donors} />;
}
