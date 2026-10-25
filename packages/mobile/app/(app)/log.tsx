import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LogWalkSchema } from '@mile-quest/shared';
import { useSession } from '@/auth/session';
import { Button, Card, Field, Notice, colors } from '@/ui/components';
import { combineLocalDateTime, distanceToMeters, nowTimeInput, preferredUnits, todayDateInput } from '@/ui/format';

export default function LogWalkScreen() {
  const { client, user } = useSession();
  const units = preferredUnits(user?.preferredUnits);
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(todayDateInput);
  const [time, setTime] = useState(nowTimeInput);
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const distanceValue = Number(distance);
    const minuteValue = Number(minutes);
    const when = combineLocalDateTime(date, time);
    if (!Number.isFinite(distanceValue) || distanceValue <= 0 || !Number.isFinite(minuteValue) || minuteValue <= 0 || !when) {
      setError(`Enter a distance in ${units}, a duration in minutes, and a date like 2026-10-25 with a time like 15:30.`);
      setSuccess(null);
      return;
    }
    if (when.getTime() > Date.now() + 5 * 60 * 1000) {
      setError('That walk is in the future.');
      setSuccess(null);
      return;
    }
    const payload = {
      distance: distanceToMeters(distanceValue, units),
      duration: Math.max(1, Math.round(minuteValue * 60)),
      timestamp: when.toISOString(),
      notes: notes.trim() || undefined,
      source: 'MANUAL' as const,
      isPrivate,
    };
    const parsed = LogWalkSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the walk details.');
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await client.createActivity(parsed.data);
      setDistance('');
      setMinutes('');
      setNotes('');
      setSuccess('Walk logged. It counts toward your team goal.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not log the walk.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Log a walk by hand. Distance is in {units} and duration is in minutes.</Text>
        <Card>
          <Field label={`Distance (${units === 'miles' ? 'miles' : 'kilometers'})`} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder={units === 'miles' ? '2.5' : '4'} />
          <Field label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" placeholder="40" />
          <Field label="Date" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-10-25" />
          <Field label="Time" value={time} onChangeText={setTime} autoCapitalize="none" placeholder="15:30" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
          <View style={styles.privateRow}>
            <View style={styles.privateCopy}>
              <Text style={styles.privateTitle}>Private</Text>
              <Text style={styles.privateBody}>Still counts for the team total. Hidden from teammates’ leaderboards.</Text>
            </View>
            <Switch accessibilityLabel="Private walk" value={isPrivate} onValueChange={setIsPrivate} />
          </View>
          {error ? <Notice message={error} /> : null}
          {success ? <Notice message={success} tone="success" /> : null}
          <Button label="Log walk" onPress={() => { void onSubmit(); }} busy={submitting} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privateCopy: { flex: 1, gap: 2 },
  privateTitle: { color: colors.text, fontWeight: '700' },
  privateBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
