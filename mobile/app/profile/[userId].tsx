import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, FriendsApi, ProfileApi, PublicProfile } from '@/src/api/client';
import { ScanCard } from '@/src/ui/ScanCard';
import { FactCell, RarityGrid, Section, StatTile } from '@/src/ui/ProfileBits';
import { useToast } from '@/src/ui/Toast';

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await ProfileApi.public(userId);
      setProfile(res);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load this profile', 'error');
      router.back();
    }
  }, [userId, toast, router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFriend = async () => {
    if (!profile || friendBusy) return;
    setFriendBusy(true);
    try {
      if (profile.is_friend) {
        await FriendsApi.removeById(profile.user_id);
        setProfile({ ...profile, is_friend: false });
        toast.show(`Removed @${profile.username}`, 'default');
      } else {
        await FriendsApi.addById(profile.user_id);
        setProfile({ ...profile, is_friend: true });
        toast.show(`Added @${profile.username}`, 'success');
      }
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not update friend status', 'error');
    } finally {
      setFriendBusy(false);
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color={theme.color.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: theme.spacing.xl }}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={theme.color.onSurface} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.identity}>
        <View style={[styles.avatarWrap, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{(profile.username ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {!profile.is_self && (
          <Pressable
            style={[styles.friendBtn, profile.is_friend && styles.friendBtnActive]}
            onPress={toggleFriend}
            disabled={friendBusy}
          >
            {friendBusy ? (
              <ActivityIndicator size="small" color={profile.is_friend ? theme.color.onSurface : theme.color.onBrand} />
            ) : (
              <>
                <Ionicons
                  name={profile.is_friend ? 'checkmark' : 'person-add'}
                  size={16}
                  color={profile.is_friend ? theme.color.onSurface : theme.color.onBrand}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.friendBtnText, profile.is_friend && styles.friendBtnTextActive]}>
                  {profile.is_friend ? 'Friends' : 'Add Friend'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.statRow}>
        <StatTile label="Points" value={profile.total_points} />
        <StatTile label="Scans" value={profile.scan_count} />
        <StatTile label="Countries" value={profile.countries_count} />
      </View>

      <Section title="Rarity breakdown">
        <RarityGrid breakdown={profile.rarity_breakdown} />
      </Section>

      <Section title="Favorites">
        <View style={styles.factsGrid}>
          <FactCell label="Top make" value={profile.top_make?.name} />
          <FactCell label="Top body style" value={profile.top_body?.name} />
          <FactCell label="Top color" value={profile.top_color?.name} />
          <FactCell label="Top origin" value={profile.top_origin?.name} />
        </View>
      </Section>

      {profile.best_scan && (
        <Section title="Best catch">
          <Text style={styles.bodyText}>
            {profile.best_scan.make} {profile.best_scan.model} ({profile.best_scan.rarity})
          </Text>
        </Section>
      )}

      <Section title="Badges & achievements">
        <Text style={styles.bodyText}>
          {profile.badge_count} Spot of the Week badge{profile.badge_count === 1 ? '' : 's'} · {profile.achievement_count} achievement{profile.achievement_count === 1 ? '' : 's'} · {profile.bonus_points_total} bonus pts
          {profile.days_since_joined ? ` · hunting for ${profile.days_since_joined} day${profile.days_since_joined === 1 ? '' : 's'}` : ''}
        </Text>
      </Section>

      {profile.recent.length > 0 && (
        <Section title="Recent catches">
          <View style={{ gap: theme.spacing.sm }}>
            {profile.recent.slice(0, 6).map((scan, idx) => (
              <ScanCard
                key={scan.scan_id ?? idx}
                imageBase64={scan.image_base64}
                title={`${scan.make} ${scan.model}`}
                subtitle={scan.country_code ?? undefined}
                rarity={scan.rarity ?? 'common'}
                points={scan.points ?? 0}
              />
            ))}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
  backText: { color: theme.color.onSurface, fontSize: 14, fontWeight: '600', marginLeft: 2 },
  identity: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, marginBottom: theme.spacing.sm },
  avatarFallback: { backgroundColor: theme.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.color.onSurface, fontWeight: '900', fontSize: 28 },
  name: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800' },
  username: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  friendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md,
    backgroundColor: theme.color.brand, borderRadius: theme.radius.pill, paddingVertical: 10, paddingHorizontal: 20,
  },
  friendBtnActive: { backgroundColor: theme.color.surfaceRaised, borderWidth: 1, borderColor: theme.color.border },
  friendBtnText: { color: theme.color.onBrand, fontWeight: '800', fontSize: 13 },
  friendBtnTextActive: { color: theme.color.onSurface },
  statRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  bodyText: { color: theme.color.onSurface, fontSize: 14, lineHeight: 20 },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
});
