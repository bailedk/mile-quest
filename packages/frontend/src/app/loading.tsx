import { PageLoading } from '@/components/loading';

export default function Loading() {
  return (
    <PageLoading 
      title="Loading Mile Quest"
      subtitle="Preparing your adventure dashboard..."
      variant="spinner"
      fullScreen
    />
  );
}