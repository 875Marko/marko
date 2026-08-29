import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, DiscoverApi } from '@/src/api/client';
import { ScanCard } from '@/src/ui/ScanCard';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { useToast } from '@/src/ui/Toast';

type Spot = Awaited<ReturnType<typeof DiscoverApi.list>>['spots'][number];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await DiscoverApi.list();
      setSpots(res.spots);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load Discover', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader title="Discover" subtitle="Rare, epic & legendary spots from the last 30 days" />
      </View>
      <FlatList
        data={spots ?? []}
        keyExtractor={(item) => item.scan_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => (
          <ScanCard
            imageBase64={item.image_base64}
            title={`${item.make} ${item.model}`}
            subtitle={item.hunter_username ? `spotted by @${item.hunter_username}` : item.country}
            rarity={item.rarity}
            points={item.points}
            onPress={() => router.push(`/profile/${item.user_id}`)}
          />
        )}
        ListEmptyComponent={
          spots ? (
            <Text style={styles.empty}>Nothing rare spotted recently — be the first!</Text>
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
  listContent: { paddingHorizontal: theme.spacing.xl, paddingBottom: 32 },
  empty: { color: theme.color.onSurfaceTertiary, textAlign: 'center', marginTop: 60 },
});
