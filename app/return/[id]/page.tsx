export const runtime = 'edge';

// AgentForm replaces ReturnForm — it's the sidebar-tabs design with the two-column layout.
import { AgentForm } from '@/components/AgentForm';

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentForm returnId={decodeURIComponent(id)} />;
}
