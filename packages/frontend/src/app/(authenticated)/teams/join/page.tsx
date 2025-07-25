'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { teamService } from '@/services/team.service';
import { Button } from '@/components/patterns/Button';
import { useAuthStore } from '@/store/auth.store';

export default function JoinTeamPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinMethod, setJoinMethod] = useState<'id' | 'code'>('id');
  const [teamId, setTeamId] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/signin');
      return;
    }

    if (joinMethod === 'id' && !teamId.trim()) {
      setError('Please enter a team ID');
      return;
    }

    if (joinMethod === 'code' && !inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const team = await teamService.joinTeam({
        teamId: joinMethod === 'id' ? teamId.trim() : undefined,
        inviteCode: joinMethod === 'code' ? inviteCode.trim() : undefined,
      });
      
      router.push(`/teams/${team.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join team');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Join a Team</h1>
        <p className="text-gray-600">
          Enter a team ID or invite code to join an existing team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Join Method Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How would you like to join?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="joinMethod"
                value="id"
                checked={joinMethod === 'id'}
                onChange={(e) => setJoinMethod(e.target.value as 'id' | 'code')}
                className="mr-2 text-blue-600"
              />
              <span className="text-gray-700">Team ID</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="joinMethod"
                value="code"
                checked={joinMethod === 'code'}
                onChange={(e) => setJoinMethod(e.target.value as 'id' | 'code')}
                className="mr-2 text-blue-600"
              />
              <span className="text-gray-700">Invite Code</span>
            </label>
          </div>
        </div>

        {/* Team ID Input */}
        {joinMethod === 'id' && (
          <div className="mb-6">
            <label htmlFor="teamId" className="block text-sm font-medium text-gray-700 mb-2">
              Team ID
            </label>
            <input
              type="text"
              id="teamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
            />
            <p className="mt-1 text-sm text-gray-500">
              Public teams can be joined with their ID. Private teams require an invite code.
            </p>
          </div>
        )}

        {/* Invite Code Input */}
        {joinMethod === 'code' && (
          <div className="mb-6">
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
              Invite Code
            </label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., ABC123"
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter the invite code shared by a team admin.
            </p>
          </div>
        )}

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/teams')}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Joining...' : 'Join Team'}
          </Button>
        </div>
      </form>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Need help?</h3>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Ask your team admin for the team ID or invite code</li>
          <li>Team IDs can be found on the team detail page</li>
          <li>Invite codes are generated by team admins</li>
          <li>You can only join public teams with their ID</li>
        </ul>
      </div>
    </div>
  );
}