import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { loadHealthSyncedAt, saveHealthSyncedAt } from '@/auth/storage';
import { useSession } from '@/auth/session';
import { readPlatformSamples } from '@/health/read';
import { healthSourceForPlatform, syncHealthWalks, syncWindowStart } from '@/health/plan';
import { Button, Card, Notice, colors } from '@/ui/components';
import { formatWhen } from '@/ui/format';

export default function HealthScreen() {
  const { client, healthOptIn, setHealthOptIn } = useSession();
  const source = healthSourceForPlatform(Platform.OS);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(useCallback(() => {
    void loadHealthSyncedAt().then(setSyncedAt).catch(() => setSyncedAt(null));
  }, []));

  async function onSync() {
    if (!source) {
      setError('Health sync is available on iPhone and Android.');
      return;
    }
    if (!healthOptIn) {
      setError('Turn on health import before syncing.');
      setMessage(null);
      return;
    }
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const since = syncWindowStart();
      const [samples, existing] = await Promise.all([
        readPlatformSamples(since),
        client.listActivitiesForSync(source, since.toISOString()),
      ]);
      const report = await syncHealthWalks({
        source,
        samples,
        existing,
        create: (draft) => client.createActivity({
          distance: draft.distanceMeters,
          duration: draft.durationSeconds,
          timestamp: draft.timestamp,
          notes: draft.notes,
          source: draft.source,
          externalId: draft.externalId,
          isPrivate: draft.isPrivate,
        }),
      });
      const finishedAt = new Date().toISOString();
      await saveHealthSyncedAt(finishedAt);
      setSyncedAt(finishedAt);
      if (samples.length === 0) {
        setMessage(emptyCopy());
      } else if (report.failed.length > 0) {
        setError(`${report.imported} imported, ${report.deduped + report.skipped} skipped, ${report.failed.length} failed. ${report.failed[0]?.message ?? ''}`);
      } else if (report.imported === 0) {
        setMessage('Nothing new to import. Walks already in Mile Quest were left as they are.');
      } else {
        setMessage(`Imported ${report.imported} ${report.imported === 1 ? 'walk' : 'walks'}. ${report.deduped + report.skipped} already counted.`);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Health sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{source === 'HEALTH_CONNECT' ? 'Health Connect' : 'Apple Health'}</Text>
        <Text style={styles.body}>
          {source === 'HEALTH_CONNECT'
            ? 'Mile Quest can read walking, running, and hiking sessions plus distance from Health Connect for the last 14 days.'
            : 'Mile Quest can read walking and running workouts, plus walking and running distance, from Apple Health for the last 14 days.'}
        </Text>
        <Text style={styles.body}>Imported walks are visible to your team. Syncing again skips samples that were already imported.</Text>
        <View style={styles.row}>
          <Text style={styles.switchLabel}>Import walks from this phone</Text>
          <Switch
            accessibilityLabel="Import walks from this phone"
            value={healthOptIn}
            onValueChange={(value) => { void setHealthOptIn(value); }}
          />
        </View>
        {syncedAt ? <Text style={styles.meta}>Last sync {formatWhen(syncedAt)}</Text> : <Text style={styles.meta}>Not synced yet</Text>}
        {error ? <Notice message={error} /> : null}
        {message ? <Notice message={message} tone="success" /> : null}
        <Button label="Sync walks" onPress={() => { void onSync(); }} disabled={!healthOptIn} busy={syncing} />
      </Card>
      <Text style={styles.meta}>{platformNote(source)}</Text>
    </ScrollView>
  );
}

function emptyCopy(): string {
  if (Platform.OS === 'ios') {
    return 'No walking distance in the last 14 days. The iOS Simulator stays empty until you add workouts in the Health app. A phone with real steps is the useful test.';
  }
  return 'No walking distance in the last 14 days. Add a walk in Health Connect, or open an app that writes steps, then sync again.';
}

function platformNote(source: 'APPLE_HEALTH' | 'HEALTH_CONNECT' | null): string {
  if (source === 'APPLE_HEALTH') {
    return 'This screen asks Apple Health for permission the first time you sync. That permission dialog only appears in a development build, not in Expo Go.';
  }
  if (source === 'HEALTH_CONNECT') {
    return 'Health Connect shows its own permission screen the first time you sync. A debug build installed from this project can read data without a Play Store listing.';
  }
  return 'Open this screen on an iPhone or Android phone.';
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
