export const runtime = 'edge';

import { ReturnForm } from '@/components/ReturnForm';

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnForm returnId={decodeURIComponent(id)} />;
}
