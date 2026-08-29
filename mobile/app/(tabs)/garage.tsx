import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, GarageResponse, ScanApi, ScanResult } from '@/src/api/client';
import { ScanCard } from '@/src/ui/ScanCard';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { useToast } from '@/src/ui/Toast';

const PAGE_SIZE = 30;

export default function GarageScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [data, setData] = useState<GarageResponse | null>(null);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (skip: number, replace: boolean) => {
    try {
      const res = await ScanApi.garage(PAGE_SIZE, skip);
      setData(res);
      setScans((prev) => (replace ? res.scans : [...prev, ...res.scans]));
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load your garage', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load(0, true);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(0, true);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (!data || loadingMore) return;
    if (scans.length >= data.total) return;
    setLoadingMore(true);
    await load(scans.length, false);
    setLoadingMore(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader
          title="Your Garage"
          subtitle={data ? `${data.total} car${data.total === 1 ? '' : 's'} collected` : undefined}
        />
      </View>
      <FlatList
        data={scans}
        keyExtractor={(item) => item.scan_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
        onEndReachedThreshold={0.4}
        onEndReached={onLoadMore}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => (
          <ScanCard
            imageBase64={item.image_base64}
            title={`${item.make} ${item.model}`}
            subtitle={item.year ? `${item.year} • ${item.color ?? 'unknown color'}` : item.color}
            rarity={item.rarity}
            points={item.points}
          />
        )}
        ListEmptyComponent={
          data ? (
            <Text style={styles.empty}>No scans yet — go spot a car!</Text>
          ) : (
            <ActivityIndicator color={theme.color.brand} style={{ marginTop: 40 }} />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.color.brand} style={{ marginVertical: 16 }} /> : null}
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
