import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, ProfileApi, ProfileStats } from '@/src/api/client';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { FactCell, RarityGrid, Section, StatTile } from '@/src/ui/ProfileBits';
import { useToast } from '@/src/ui/Toast';
import { useAuth } from '@/src/auth/AuthContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ProfileApi.stats();
      setStats(res);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load profile stats', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: theme.spacing.xl }}
    >
      <View style={styles.headerRow}>
        <ScreenHeader title="Profile" />
        <Pressable style={styles.atlasBtn} onPress={() => router.push('/atlas')}>
          <Ionicons name="globe-outline" size={16} color={theme.color.brand} style={{ marginRight: 6 }} />
          <Text style={styles.atlasBtnText}>Atlas</Text>
        </Pressable>
      </View>

      <View style={styles.identity}>
        {user.picture ? (
          <View style={styles.avatarWrap} />
        ) : (
          <View style={[styles.avatarWrap, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      <View style={styles.statRow}>
        <StatTile label="Points" value={user.total_points} />
        <StatTile label="Scans" value={user.scan_count} />
        <StatTile label="Countries" value={stats?.countries_count ?? '—'} />
      </View>

      {!stats ? (
        <ActivityIndicator color={theme.color.brand} style={{ marginTop: 32 }} />
      ) : (
        <>
          <Section title="Today">
            <Text style={styles.bodyText}>
              {stats.scans_remaining_today} of {stats.daily_limit} scans remaining
            </Text>
          </Section>

          <Section title="Rarity breakdown">
            <RarityGrid breakdown={stats.rarity_breakdown} />
          </Section>

          <Section title="Favorites">
            <View style={styles.factsGrid}>
              <FactCell label="Top make" value={stats.top_make?.name} />
              <FactCell label="Top body style" value={stats.top_body?.name} />
              <FactCell label="Top color" value={stats.top_color?.name} />
              <FactCell label="Top origin" value={stats.top_origin?.name} />
            </View>
          </Section>

          {stats.best_scan && (
            <Section title="Best catch">
              <Text style={styles.bodyText}>
                {stats.best_scan.make} {stats.best_scan.model} ({stats.best_scan.rarity})
              </Text>
            </Section>
          )}

          <Section title="Badges & achievements">
            <Text style={styles.bodyText}>
              {stats.badge_count} Spot of the Week badge{stats.badge_count === 1 ? '' : 's'} · {stats.achievement_count} achievement{stats.achievement_count === 1 ? '' : 's'} · {stats.bonus_points_total} bonus pts
              {stats.days_since_joined ? ` · hunting for ${stats.days_since_joined} day${stats.days_since_joined === 1 ? '' : 's'}` : ''}
            </Text>
          </Section>
        </>
      )}

      <Pressable style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.8 }]} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={theme.color.error} style={{ marginRight: 8 }} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  atlasBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceCard,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill,
    paddingVertical: 8, paddingHorizontal: 14, marginTop: 2,
  },
  atlasBtnText: { color: theme.color.brand, fontWeight: '800', fontSize: 12.5 },
  identity: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, marginBottom: theme.spacing.sm },
  avatarFallback: { backgroundColor: theme.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.color.onSurface, fontWeight: '900', fontSize: 28 },
  name: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800' },
  username: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  bodyText: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.lg,
    paddingVertical: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.error,
  },
  signOutText: { color: theme.color.error, fontWeight: '700' },
});
