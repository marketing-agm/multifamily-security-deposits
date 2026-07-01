export const runtime = 'edge';

import { ReviewSubmit } from '@/components/ReviewSubmit';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewSubmit returnId={decodeURIComponent(id)} />;
}
