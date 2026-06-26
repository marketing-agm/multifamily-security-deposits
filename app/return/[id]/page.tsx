export const runtime = 'edge';

import { AgentForm } from '@/components/AgentForm';

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentForm returnId={decodeURIComponent(id)} />;
}
