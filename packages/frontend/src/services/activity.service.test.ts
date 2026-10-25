import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { activityService } from '@/services/activity.service';

vi.mock('@/services/api-client', () => ({
  apiClient: { get: vi.fn() },
  apiUrl: (path: string) => path,
}));

describe('activityService.getUserTotalDistance', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('sums the signed-in user activities inside the goal window', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        items: [{ distance: 3200 }, { distance: 1500 }],
        nextCursor: null,
        hasMore: false,
      },
    } as Awaited<ReturnType<typeof apiClient.get>>);

    const total = await activityService.getUserTotalDistance(
      'user-1',
      'team-1',
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-11-01T00:00:00.000Z'),
    );

    expect(total).toBe(4700);
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/activities?'),
    );
  });
});
