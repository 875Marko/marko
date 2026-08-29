import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, LeaderboardApi, User } from '@/src/api/client';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { useToast } from '@/src/ui/Toast';
import { useAuth } from '@/src/auth/AuthContext';

type Scope = 'global' | 'friends';

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('global');
  const [users, setUsers] = useState<User[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (s: Scope) => {
    try {
      const res = s === 'global' ? await LeaderboardApi.global() : await LeaderboardApi.friends();
      setUsers(res.users);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load leaderboard', 'error');
    }
  }, [toast]);

  useEffect(() => {
    setUsers(null);
    load(scope);
  }, [scope, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(scope);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader title="Leaderboard" subtitle="Top hunters, ranked by points" />
        <View style={styles.segments}>
          {(['global', 'friends'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setScope(k)}
              style={[styles.segment, scope === k && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, scope === k && styles.segmentTextActive]}>
                {k === 'global' ? 'Global' : 'Friends'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={users ?? []}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.user_id === user?.user_id && styles.rowMe]}>
            <Text style={styles.rank}>{index + 1}</Text>
            {item.picture ? (
              <Image source={{ uri: item.picture }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.points}>{item.total_points}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          users ? (
            <Text style={styles.empty}>
              {scope === 'friends' ? 'Add friends to see them here' : 'No players yet'}
            </Text>
          ) : (
            <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  headerWrap: { paddingHorizontal: theme.spacing.xl },
  segments: {
    flexDirection: 'row', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.pill,
    padding: 4, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.color.brand },
  segmentText: { color: theme.color.onSurfaceTertiary, fontWeight: '800', fontSize: 13 },
  segmentTextActive: { color: theme.color.onBrand },
  listContent: { paddingHorizontal: theme.spacing.xl, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md,
  },
  rowMe: { borderColor: theme.color.brand },
  rank: { color: theme.color.onSurfaceTertiary, fontWeight: '800', width: 22, textAlign: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: theme.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.color.onSurface, fontWeight: '800' },
  name: { color: theme.color.onSurface, fontWeight: '700', fontSize: 14 },
  username: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  points: { color: theme.color.brand, fontWeight: '900', fontSize: 16 },
  pointsLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10 },
  empty: { color: theme.color.onSurfaceTertiary, textAlign: 'center', marginTop: 60 },
});
