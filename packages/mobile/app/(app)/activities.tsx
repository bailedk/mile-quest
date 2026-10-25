import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ActivityListItem } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, Card, Notice, colors } from '@/ui/components';
import { formatMeters, formatPaceFromMeters, formatWalkDuration, formatWhen, preferredUnits, sourceLabel } from '@/ui/format';

export default function ActivitiesScreen() {
  const { client, user } = useSession();
  const units = preferredUnits(user?.preferredUnits);
  const [items, setItems] = useState<ActivityListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const page = await client.listActivities({ limit: 20 });
    setItems(page.items);
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
  }, [client]);

  useFocusEffect(useCallback(() => {
    void load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load walks.');
    });
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load walks.');
    } finally {
      setRefreshing(false);
    }
  }

  async function onMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await client.listActivities({ cursor, limit: 20 });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load more walks.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />}
    >
      {error ? <Notice message={error} /> : null}
      {items.length === 0 && !error ? (
        <Card>
          <Text style={styles.title}>No walks yet</Text>
          <Text style={styles.body}>Log one by hand, or import walking distance from Health.</Text>
        </Card>
      ) : null}
      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}>
            <Text style={styles.title}>{formatMeters(item.distance, units)}</Text>
            <Text style={styles.source}>{sourceLabel(item.source)}{item.isPrivate ? ' · Private' : ''}</Text>
          </View>
          <Text style={styles.body}>{formatWalkDuration(item.duration)} · {formatPaceFromMeters(item.distance, item.duration, units)}</Text>
          <Text style={styles.when}>{formatWhen(item.timestamp)}</Text>
          {item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}
        </Card>
      ))}
      {hasMore ? <Button label="Load more" variant="quiet" onPress={() => { void onMore(); }} busy={loadingMore} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  source: { color: colors.muted, fontSize: 13 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  when: { color: colors.text, fontSize: 14 },
});
