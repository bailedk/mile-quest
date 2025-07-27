'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileLayout, useMobileLayout } from '@/components/layout/MobileLayout';
import { TouchCard, TouchButton, PullToRefresh } from '@/components/mobile/TouchInteractions';
import { Card } from '@/components/patterns/Card';
import { Button } from '@/components/patterns/Button';
import { useAuthStore } from '@/store/auth.store';
import { useUser, optimizedFetch } from '@/utils/optimizedFetching';
import { AuthUser } from '@mile-quest/shared';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { data: userData, refetch: refetchUser, isRefetching } = useUser();
  const { isMobile } = useMobileLayout();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Use fetched user data if available, otherwise fall back to auth store
  const currentUser = userData || user;

  const handleRefresh = async () => {
    await refetchUser();
  };

  const handleEdit = () => {
    setEditedName(currentUser?.name || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedName('');
  };

  const handleSave = async () => {
    if (!editedName.trim() || editedName === currentUser?.name) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await optimizedFetch<AuthUser>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: editedName.trim() }),
      });

      // Update the auth store with new user data
      useAuthStore.setState({ user: updatedUser });

      setIsEditing(false);
      setEditedName('');
      await refetchUser(); // Refresh the cached data
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        await signOut();
        // Use replace instead of push to prevent back navigation
        router.replace('/');
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  const notAuthenticatedContent = (
    <div className={isMobile ? "flex items-center justify-center min-h-screen -mt-20" : "container mx-auto px-4 py-8"}>
      <div className="text-center px-6 max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Sign In Required
        </h2>
        <p className="text-gray-600 mb-6">
          Please sign in to view your profile and settings.
        </p>
        {isMobile ? (
          <TouchButton
            onClick={() => router.push('/signin')}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Sign In
          </TouchButton>
        ) : (
          <Button
            onClick={() => router.push('/signin')}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Sign In
          </Button>
        )}
      </div>
    </div>
  );

  if (!isAuthenticated || !currentUser) {
    return isMobile ? (
      <MobileLayout title="Profile">
        {notAuthenticatedContent}
      </MobileLayout>
    ) : notAuthenticatedContent;
  }

  const mainContent = (
    <div className={isMobile ? "px-4 py-6 space-y-4 pb-20" : "container mx-auto px-4 py-8 max-w-4xl"}>
      {/* Profile Header */}
      <div className={isMobile ? "bg-gradient-to-b from-gray-50 to-white -mx-4 -mt-6 px-4 pt-8 pb-6" : "bg-white rounded-lg shadow-sm p-8 mb-6"}>
        <div className="text-center">
          {isEditing ? (
            <div className="max-w-sm mx-auto">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-3 ${isMobile ? "text-lg" : "text-xl"} text-center`}
                placeholder="Enter your name"
                disabled={isSaving}
                autoFocus
              />
              <div className="flex gap-2 justify-center">
                {isMobile ? (
                  <>
                    <TouchButton
                      onClick={handleSave}
                      variant="primary"
                      size="sm"
                      disabled={isSaving || !editedName.trim() || editedName === currentUser.name}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </TouchButton>
                    <TouchButton
                      onClick={handleCancel}
                      variant="secondary"
                      size="sm"
                      disabled={isSaving}
                    >
                      Cancel
                    </TouchButton>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      variant="primary"
                      size="sm"
                      disabled={isSaving || !editedName.trim() || editedName === currentUser.name}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="secondary"
                      size="sm"
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <h1 className={`font-bold text-gray-900 ${isMobile ? "text-2xl" : "text-3xl"}`}>{currentUser.name || 'User'}</h1>
              <p className="text-gray-600 mt-1">{currentUser.email}</p>
              {isMobile ? (
                <TouchButton
                  onClick={handleEdit}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Edit Profile
                </TouchButton>
              ) : (
                <Button
                  onClick={handleEdit}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Edit Profile
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Settings Section */}
      <div className="space-y-2">
        <h2 className={`font-semibold text-gray-500 uppercase tracking-wider px-1 ${isMobile ? "text-xs" : "text-sm"}`}>
          Preferences
        </h2>
        {isMobile ? (
          <TouchCard className="divide-y divide-gray-100">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-900">Preferred Units</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700">
                  {currentUser.preferredUnits === 'kilometers' ? 'Kilometers' : 'Miles'}
                </span>
                <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </TouchCard>
        ) : (
          <Card className="divide-y divide-gray-100">
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-900">Preferred Units</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700">
                  {currentUser.preferredUnits === 'kilometers' ? 'Kilometers' : 'Miles'}
                </span>
                <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className={`font-semibold text-gray-500 uppercase tracking-wider px-1 ${isMobile ? "text-xs" : "text-sm"}`}>
          Quick Actions
        </h2>
        <div className="space-y-2">
          {isMobile ? (
            <>
              <TouchButton
                onClick={() => router.push('/teams')}
                variant="secondary"
                size="lg"
                className="w-full justify-between group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-active:bg-gray-200 transition-colors">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-gray-900 font-medium">Manage Teams</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </TouchButton>

              <TouchButton
                onClick={() => router.push('/activities')}
                variant="secondary"
                size="lg"
                className="w-full justify-between group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-active:bg-green-200 transition-colors">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-gray-900 font-medium">View Activities</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </TouchButton>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Card 
                hoverable 
                className="cursor-pointer"
                onClick={() => router.push('/teams')}
              >
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-gray-900 font-medium">Manage Teams</span>
                </div>
              </Card>
              
              <Card 
                hoverable 
                className="cursor-pointer"
                onClick={() => router.push('/activities')}
              >
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-gray-900 font-medium">View Activities</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <div className="pt-4">
        {isMobile ? (
          <TouchButton
            onClick={handleSignOut}
            variant="secondary"
            size="lg"
            className="w-full justify-center border-red-200 hover:bg-red-50 active:bg-red-100"
          >
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-red-600 font-medium">Sign Out</span>
          </TouchButton>
        ) : (
          <Button
            onClick={handleSignOut}
            variant="secondary"
            size="lg"
            className="w-full justify-center border-red-200 hover:bg-red-50"
          >
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-red-600 font-medium">Sign Out</span>
          </Button>
        )}
      </div>
    </div>
  );

  return isMobile ? (
    <MobileLayout title="Profile">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefetching}>
        {mainContent}
      </PullToRefresh>
    </MobileLayout>
  ) : mainContent;
}