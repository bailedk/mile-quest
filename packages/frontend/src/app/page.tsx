import Link from 'next/link';
import { Layout } from '@/components/layout';

export default function Home() {
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Walk Together, Go Further
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Track team walking goals
          </p>
          <p className="text-xl text-gray-600 mb-12">
            Build healthy habits
          </p>
          
          {/* Auth Buttons */}
          <div className="space-y-4 max-w-sm mx-auto">
            <button className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2">
              <span>Continue with Google</span>
            </button>
            
            <Link href="/signup" className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center">
              Sign up with Email
            </Link>
            
            <p className="text-sm text-gray-600 mt-6">
              Already have a team?{' '}
              <Link href="/signin" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
        
        {/* Features Section */}
        <div className="py-12 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl mb-4">🚶</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Progress</h3>
              <p className="text-gray-600">Log walks and see your team&apos;s collective distance</p>
            </div>
            <div>
              <div className="text-3xl mb-4">👥</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Goals</h3>
              <p className="text-gray-600">Set distance targets and achieve them together</p>
            </div>
            <div>
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Works Offline</h3>
              <p className="text-gray-600">Log activities anywhere, sync when connected</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}