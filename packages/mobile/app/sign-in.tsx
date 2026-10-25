import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginSchema } from '@mile-quest/shared';
import { DEFAULT_API_BASE_URL, resolveApiUrl } from '@/api/config';
import { useSession } from '@/auth/session';
import { Button, Card, Field, Notice, colors } from '@/ui/components';

export default function SignInScreen() {
  const { user, ready, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (ready && user) return <Redirect href="/" />;

  async function onSubmit() {
    const parsed = LoginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter your email and password.');
      return;
    }
    try {
      resolveApiUrl(apiBaseUrl, '/api/auth/login');
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Check the server address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn({ email: parsed.data.email, password: parsed.data.password, apiBaseUrl });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Mile Quest</Text>
          <Text style={styles.title}>Walk together.</Text>
          <Text style={styles.subtitle}>Sign in to see your team’s goal, log a walk, or bring in steps from your phone.</Text>
          <Card>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <Field label="Server" value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCapitalize="none" placeholder={DEFAULT_API_BASE_URL} />
            {error ? <Notice message={error} /> : null}
            <Button label="Sign in" onPress={() => { void onSubmit(); }} disabled={!ready} busy={submitting} />
          </Card>
          <View>
            <Text style={styles.hint}>The default server is the deployed Mile Quest app. Change it if you are pointed at another environment.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },
  kicker: { color: colors.primary, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
