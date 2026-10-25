import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DashboardResponse } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, Card, Notice, ProgressBar, Stat, colors } from '@/ui/components';
import { formatMeters, preferredUnits, progressPercent } from '@/ui/format';

export default function DashboardScreen() {
  const { client, user, signOut } = useSession();
  const units = preferredUnits(user?.preferredUnits);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDashboard(await client.dashboard());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the dashboard.');
    }
  }, [client]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const stats = dashboard?.personalStats;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />}
    >
      <Text style={styles.greeting}>Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
      <Text style={styles.subtitle}>Team progress counts every walk, including private ones. The leaderboard shows walks your teammates chose to share.</Text>
      {error ? <Notice message={error} /> : null}

      {stats ? (
        <Card>
          <Text style={styles.cardTitle}>You</Text>
          <View style={styles.stats}>
            <Stat label="Distance" value={formatMeters(stats.totalDistance, units)} />
            <Stat label="Walks" value={String(stats.totalActivities)} />
            <Stat label="Streak" value={`${stats.currentStreak}d`} />
            <Stat label="This week" value={formatMeters(stats.thisWeek.distance, units)} />
          </View>
        </Card>
      ) : null}

      {dashboard?.teams.length === 0 ? (
        <Card>
          <Text style={styles.cardTitle}>No team yet</Text>
          <Text style={styles.body}>Create or join a team on the web app. Walks you log here still count toward your personal total.</Text>
        </Card>
      ) : null}

      {dashboard?.teams.map((team) => {
        const board = dashboard.teamLeaderboards.find((entry) => entry.teamId === team.id);
        const percent = team.progress ? progressPercent(team.progress.currentDistance, team.progress.targetDistance) : 0;
        return (
          <Card key={team.id}>
            <Text style={styles.cardTitle}>{team.name}</Text>
            {team.progress ? (
              <>
                <Text style={styles.body}>{team.progress.goalName}</Text>
                <ProgressBar percent={percent} />
                <Text style={styles.meta}>
                  {formatMeters(team.progress.currentDistance, units)} of {formatMeters(team.progress.targetDistance, units)} · {percent}% · {team.progress.daysRemaining} days left
                </Text>
                <Text style={styles.meta}>{team.progress.isOnTrack ? 'On pace' : 'Behind pace'}</Text>
              </>
            ) : (
              <Text style={styles.body}>This team does not have an active goal yet.</Text>
            )}
            {board && board.members.length > 0 ? (
              <View style={styles.board}>
                <Text style={styles.section}>Leaderboard</Text>
                {board.members.map((member, index) => (
                  <View key={member.userId} style={styles.row}>
                    <Text style={styles.rank}>{index + 1}</Text>
                    <Text style={[styles.name, member.userId === user?.id && styles.you]}>{member.name}</Text>
                    <Text style={styles.distance}>{formatMeters(member.distance, units)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}

      <Button label="Sign out" variant="quiet" onPress={() => { void signOut(); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.muted, fontSize: 13 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  board: { gap: 8, marginTop: 4 },
  section: { fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { width: 22, color: colors.muted, fontWeight: '700' },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  you: { fontWeight: '700' },
  distance: { color: colors.text, fontWeight: '600' },
});
