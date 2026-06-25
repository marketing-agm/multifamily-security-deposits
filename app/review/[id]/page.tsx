import { ReviewScreen } from '@/components/Review';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewScreen returnId={decodeURIComponent(id)} />;
}
