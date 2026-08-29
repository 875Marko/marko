import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, ProfileApi, ProfileStats } from '@/src/api/client';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { useToast } from '@/src/ui/Toast';
import { useAuth } from '@/src/auth/AuthContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
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
      <ScreenHeader title="Profile" />

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
            <View style={styles.rarityGrid}>
              {Object.entries(stats.rarity_breakdown).map(([rarity, count]) => (
                <View key={rarity} style={styles.rarityCell}>
                  <Text style={styles.rarityCount}>{count}</Text>
                  <Text style={styles.rarityLabel}>{rarity}</Text>
                </View>
              ))}
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

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  identity: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, marginBottom: theme.spacing.sm },
  avatarFallback: { backgroundColor: theme.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.color.onSurface, fontWeight: '900', fontSize: 28 },
  name: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800' },
  username: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  statTile: {
    flex: 1, alignItems: 'center', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, paddingVertical: theme.spacing.md,
  },
  statValue: { color: theme.color.brand, fontSize: 20, fontWeight: '900' },
  statLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '800', marginBottom: 8, letterSpacing: 0.4 },
  bodyText: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
  rarityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  rarityCell: {
    minWidth: 64, alignItems: 'center', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, paddingVertical: 10, paddingHorizontal: 12,
  },
  rarityCount: { color: theme.color.onSurface, fontWeight: '800', fontSize: 15 },
  rarityLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.lg,
    paddingVertical: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.error,
  },
  signOutText: { color: theme.color.error, fontWeight: '700' },
});
