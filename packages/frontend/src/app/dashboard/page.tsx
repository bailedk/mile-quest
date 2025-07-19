'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const { isLoading } = useRequireAuth();
  const { user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome back, {user?.name}!</h2>
          <p className="text-gray-600">
            This is your dashboard. More features coming soon!
          </p>
          
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Your Profile</h3>
            <dl className="space-y-1">
              <div className="flex">
                <dt className="font-medium text-gray-500 w-24">Name:</dt>
                <dd className="text-gray-900">{user?.name}</dd>
              </div>
              <div className="flex">
                <dt className="font-medium text-gray-500 w-24">Email:</dt>
                <dd className="text-gray-900">{user?.email}</dd>
              </div>
              <div className="flex">
                <dt className="font-medium text-gray-500 w-24">Units:</dt>
                <dd className="text-gray-900">{user?.preferredUnits || 'miles'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}