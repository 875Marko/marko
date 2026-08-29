import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { theme } from '@/src/theme';

const HERO = 'https://images.unsplash.com/photo-1657769106786-b6f50ac90f5f?crop=entropy&cs=srgb&fm=jpg&q=80&w=1080';

export default function Landing() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/(tabs)');
  }, [loading, user, router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]} testID="splash-loading">
        <ActivityIndicator color={theme.color.brand} size="large" />
      </View>
    );
  }

  const submit = async () => {
    setError(null);
    const u = username.trim().toLowerCase();
    if (!u || !password) { setError('Username and password required'); return; }
    setSubmitting(true);
    try {
      if (mode === 'login') await signIn(u, password);
      else await signUp(u, password, displayName.trim() || undefined);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="landing-screen">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={['rgba(15,17,21,0.4)', 'rgba(15,17,21,0.9)', '#0F1115']}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="car-sport" size={22} color={theme.color.onBrand} />
            </View>
            <Text style={styles.brandText}>Car Spotter</Text>
          </View>

          <View style={{ height: 32 }} />

          <Text style={styles.kicker}>SCAN. COLLECT. COMPETE.</Text>
          <Text style={styles.title}>Hunt the world's{'\n'}rarest cars.</Text>
          <Text style={styles.subtitle}>
            Point your camera at any car. AI identifies it, scores rarity, and ranks you on the global leaderboard.
          </Text>

          <View style={styles.segments}>
            {(['login', 'register'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => { setMode(k); setError(null); }}
                style={[styles.segment, mode === k && styles.segmentActive]}
                testID={`mode-${k}`}
              >
                <Text style={[styles.segmentText, mode === k && styles.segmentTextActive]}>
                  {k === 'login' ? 'Log in' : 'Sign up'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={theme.color.onSurfaceTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            testID="username-input"
          />
          <View style={styles.pwWrap}>
            <TextInput
              style={styles.pwInput}
              placeholder="Password"
              placeholderTextColor={theme.color.onSurfaceTertiary}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
              testID="password-input"
            />
            <Pressable
              onPress={() => setShowPw((v) => !v)}
              style={styles.pwToggle}
              testID="password-toggle"
              hitSlop={8}
            >
              <Ionicons
                name={showPw ? 'eye-off' : 'eye'}
                size={18}
                color={theme.color.onSurfaceTertiary}
              />
            </Pressable>
          </View>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Display name (optional)"
              placeholderTextColor={theme.color.onSurfaceTertiary}
              value={displayName}
              onChangeText={setDisplayName}
              testID="display-name-input"
            />
          )}

          {!!error && <Text style={styles.error} testID="auth-error">{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.cta, (pressed || submitting) && { opacity: 0.85 }]}
            onPress={submit}
            disabled={submitting}
            testID="submit-button"
          >
            {submitting ? (
              <ActivityIndicator color={theme.color.onBrand} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'login' ? 'log-in' : 'person-add'}
                  size={18}
                  color={theme.color.onBrand}
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.ctaText}>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to play fair and scan real cars.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: theme.spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center',
  },
  brandText: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  kicker: { color: theme.color.brand, fontSize: 12, letterSpacing: 3, fontWeight: '700', marginBottom: 12 },
  title: { color: theme.color.onSurface, fontSize: 36, fontWeight: '900', lineHeight: 40, marginBottom: 12 },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  segments: {
    flexDirection: 'row', backgroundColor: 'rgba(28,31,38,0.85)', borderRadius: 999,
    padding: 4, marginBottom: 14, borderWidth: 1, borderColor: theme.color.border,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.color.brand },
  segmentText: { color: theme.color.onSurfaceTertiary, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  segmentTextActive: { color: theme.color.onBrand },
  input: {
    backgroundColor: 'rgba(28,31,38,0.92)', color: theme.color.onSurface,
    paddingHorizontal: 16, height: 48, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: theme.color.border, fontSize: 15,
  },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,31,38,0.92)',
    borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.color.border,
  },
  pwInput: {
    flex: 1, color: theme.color.onSurface,
    paddingHorizontal: 16, height: 48, fontSize: 15,
  },
  pwToggle: { paddingHorizontal: 14, height: 48, alignItems: 'center', justifyContent: 'center' },
  error: { color: theme.color.error, marginBottom: 8, fontWeight: '600' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: 14, marginTop: 6,
  },
  ctaText: { color: theme.color.onBrand, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  legal: { color: theme.color.onSurfaceTertiary, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
