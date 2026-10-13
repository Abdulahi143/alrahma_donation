import Link from 'next/link';
import { ComingSoon } from '@/components/admin/ui';
export default function Page() {
  return (
    <ComingSoon title="Betalsätt" phase="Kommer i fas 4" why="Här styrs vart givarnas pengar går. Ändringar ska godkännas av en andra admin innan de gäller.">
      <p className="mt-3 text-sm">Tills vidare ändras betalkonton i den <Link href="/admin/legacy" className="font-bold text-mosque-emerald underline">gamla adminpanelen</Link> (fliken Betalkonton).</p>
    </ComingSoon>
  );
}
