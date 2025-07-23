'use client';

import { useAuthStore } from '@/store/auth.store';
import { useHydrated } from '@/hooks/useHydrated';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function TestHydrationPage() {
  const hydrated = useHydrated();
  const { isAuthenticated, user } = useAuthStore();
  const { isOnline } = useOnlineStatus();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Hydration Test Page</h1>
      
      <div className="space-y-2">
        <p>Hydrated: {String(hydrated)}</p>
        <p>Authenticated: {String(hydrated ? isAuthenticated : false)}</p>
        <p>Online: {String(isOnline)}</p>
        <p>User: {hydrated && user ? user.email : 'None'}</p>
        <p>NODE_ENV: {process.env.NODE_ENV}</p>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Debug Info</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify({
            hydrated,
            isAuthenticated: hydrated ? isAuthenticated : false,
            isOnline,
            hasUser: !!user,
            nodeEnv: process.env.NODE_ENV
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}