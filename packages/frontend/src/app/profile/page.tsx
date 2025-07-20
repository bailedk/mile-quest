'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TouchCard, TouchButton } from '@/components/mobile/TouchInteractions';
import { useAuthStore } from '@/store/auth.store';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <MobileLayout title="Profile">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Please Sign In
            </h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to view your profile.
            </p>
            <TouchButton
              onClick={() => window.location.href = '/signin'}
              variant="primary"
              size="md"
            >
              Sign In
            </TouchButton>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Profile">
      <div className="space-y-6 pb-20">
        {/* Profile Header */}
        <TouchCard className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{user.name || 'User'}</h1>
          <p className="text-gray-600">{user.email}</p>
          <div className="mt-4">
            <TouchButton
              onClick={() => setIsEditing(!isEditing)}
              variant="secondary"
              size="sm"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </TouchButton>
          </div>
        </TouchCard>

        {/* Profile Settings */}
        <TouchCard>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Preferred Units</span>
              <span className="text-gray-600">
                {user.preferredUnits === 'kilometers' ? 'Kilometers' : 'Miles'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Notifications</span>
              <span className="text-gray-600">Enabled</span>
            </div>
          </div>
        </TouchCard>

        {/* Quick Actions */}
        <TouchCard>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <TouchButton
              onClick={() => window.location.href = '/teams'}
              variant="secondary"
              size="md"
              className="w-full justify-start"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Manage Teams
            </TouchButton>
            <TouchButton
              onClick={() => window.location.href = '/activities'}
              variant="secondary"
              size="md"
              className="w-full justify-start"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Activities
            </TouchButton>
          </div>
        </TouchCard>

        {/* Account Actions */}
        <TouchCard>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <div className="space-y-3">
            <TouchButton
              onClick={() => {
                if (confirm('Are you sure you want to sign out?')) {
                  // TODO: Implement sign out
                  window.location.href = '/';
                }
              }}
              variant="secondary"
              size="md"
              className="w-full justify-start text-red-600"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </TouchButton>
          </div>
        </TouchCard>
      </div>
    </MobileLayout>
  );
}