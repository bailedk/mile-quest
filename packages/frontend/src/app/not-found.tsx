import Link from 'next/link';
import { Layout } from '@/components/layout';

export default function NotFound() {
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-8xl font-bold text-gray-300 mb-4">404</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Page not found
          </h2>
          <p className="text-gray-600 mb-8">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
          </p>
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go back home
            </Link>
            <Link
              href="/dashboard"
              className="block w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}