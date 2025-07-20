import { Layout } from '@/components/layout';
import { NotFoundError } from '@/components/error';

export default function NotFound() {
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <NotFoundError />
      </div>
    </Layout>
  );
}