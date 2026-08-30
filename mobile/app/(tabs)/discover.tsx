import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, AtlasApi, AtlasCountry, DiscoverApi, GlobePin } from '@/src/api/client';
import { Globe, GlobeHandle } from '@/src/ui/Globe';
import { RegionMap } from '@/src/ui/RegionMap';
import { MapPin } from '@/src/lib/leafletHtml';
import { RarityBadge } from '@/src/ui/RarityBadge';
import { ScanCard } from '@/src/ui/ScanCard';
import { ScreenHeader } from '@/src/ui/ScreenHeader';
import { useToast } from '@/src/ui/Toast';

type Spot = Awaited<ReturnType<typeof DiscoverApi.list>>['spots'][number];

const MAP_ZOOM_THRESHOLD = 2.2;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const globeRef = useRef<GlobeHandle>(null);

  const [mine, setMine] = useState<GlobePin[]>([]);
  const [friends, setFriends] = useState<GlobePin[]>([]);
  const [countries, setCountries] = useState<AtlasCountry[] | null>(null);
  const [selected, setSelected] = useState<{ pin: GlobePin; source: 'mine' | 'friends' } | null>(null);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    try {
      const [globeRes, atlasRes, discoverRes] = await Promise.all([
        AtlasApi.globe(), AtlasApi.get(), DiscoverApi.list(),
      ]);
      setMine(globeRes.mine);
      setFriends(globeRes.friends);
      setCountries(atlasRes.countries);
      setSpots(discoverRes.spots);
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

  const handleMarkerPress = (id: string, source: 'mine' | 'friends') => {
    const pool = source === 'mine' ? mine : friends;
    const pin = pool.find((p) => p.scan_id === id);
    if (pin) setSelected({ pin, source });
  };

  const handleZoomChange = (zoom: number) => {
    if (zoom >= MAP_ZOOM_THRESHOLD && !showMap) setShowMap(true);
  };

  const backToGlobe = () => {
    setShowMap(false);
    globeRef.current?.resetZoom();
  };

  const regionPins: MapPin[] = [
    ...mine.map((p) => ({ lat: p.latitude, lng: p.longitude, make: p.make, model: p.model, color: theme.color.brand })),
    ...friends.map((p) => ({
      lat: p.latitude, lng: p.longitude, make: p.make, model: p.model,
      color: theme.color.rarity.rare, username: p.username, userId: p.user_id,
    })),
  ];

  const globeSize = Math.min(320, width - theme.spacing.xl * 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brand} />}
    >
      <View style={styles.headerWrap}>
        <ScreenHeader title="Discover" subtitle="Where you and your friends have been spotting" />
      </View>

      {showMap ? (
        <View style={[styles.mapWrap, { height: globeSize + 60 }]}>
          <RegionMap pins={regionPins} onOpenProfile={(userId) => router.push(`/profile/${userId}`)} />
          <Pressable style={styles.backToGlobeBtn} onPress={backToGlobe}>
            <Ionicons name="globe-outline" size={14} color={theme.color.onSurface} style={{ marginRight: 6 }} />
            <Text style={styles.backToGlobeText}>Back to globe</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.globeWrap}>
          <Globe
            ref={globeRef}
            size={globeSize}
            mine={mine.map((p) => ({ id: p.scan_id, lat: p.latitude, lng: p.longitude }))}
            friends={friends.map((p) => ({ id: p.scan_id, lat: p.latitude, lng: p.longitude }))}
            onMarkerPress={handleMarkerPress}
            onZoomChange={handleZoomChange}
          />
        </View>
      )}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.color.brand }]} />
          <Text style={styles.legendText}>Your scans ({mine.length})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.color.rarity.rare }]} />
          <Text style={styles.legendText}>Friends' scans ({friends.length})</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {showMap ? 'Pan and zoom the map · tap a pin for details' : 'Drag to rotate · pinch to zoom into a real map · tap a pin for details'}
      </Text>

      {selected && (
        <View style={styles.selectedCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedTitle}>{selected.pin.make} {selected.pin.model}</Text>
            <Text style={styles.selectedSub}>
              {selected.source === 'friends' && selected.pin.username ? `@${selected.pin.username} · ` : ''}
              {selected.pin.country ?? 'Unknown location'}
            </Text>
            <View style={{ marginTop: 8 }}>
              <RarityBadge rarity={selected.pin.rarity} size="sm" />
            </View>
          </View>
          {selected.source === 'friends' && (
            <Pressable style={styles.viewProfileBtn} onPress={() => router.push(`/profile/${selected.pin.user_id}`)}>
              <Text style={styles.viewProfileText}>Profile</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Countries visited</Text>
        {!countries || countries.length === 0 ? (
          <Text style={styles.empty}>No located scans yet — location tags on your scans will show up here.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {countries.map((c) => (
              <View key={`${c.country}-${c.code}`} style={styles.countryRow}>
                <Text style={styles.countryCode}>{c.code ?? '—'}</Text>
                <Text style={styles.countryName} numberOfLines={1}>{c.country}</Text>
                <Text style={styles.countryCount}>{c.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rare, epic & legendary spots</Text>
        {!spots ? (
          <ActivityIndicator color={theme.color.brand} style={{ marginTop: 12 }} />
        ) : spots.length === 0 ? (
          <Text style={styles.empty}>Nothing rare spotted recently — be the first!</Text>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {spots.map((item) => (
              <ScanCard
                key={item.scan_id}
                imageBase64={item.image_base64}
                title={`${item.make} ${item.model}`}
                subtitle={item.hunter_username ? `spotted by @${item.hunter_username}` : item.country}
                rarity={item.rarity}
                points={item.points}
                onPress={() => router.push(`/profile/${item.user_id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  headerWrap: { paddingHorizontal: theme.spacing.xl },
  globeWrap: { alignItems: 'center', marginTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  mapWrap: {
    marginHorizontal: theme.spacing.xl, marginTop: theme.spacing.sm, marginBottom: theme.spacing.md,
    borderRadius: theme.radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: theme.color.border,
  },
  backToGlobeBtn: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,17,21,0.75)', borderRadius: theme.radius.pill,
    paddingVertical: 7, paddingHorizontal: 12, zIndex: 10,
  },
  backToGlobeText: { color: theme.color.onSurface, fontWeight: '700', fontSize: 11.5 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  hint: { color: theme.color.onSurfaceTertiary, fontSize: 11, textAlign: 'center', marginBottom: theme.spacing.lg },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginHorizontal: theme.spacing.xl,
    backgroundColor: theme.color.surfaceCard, borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.lg,
  },
  selectedTitle: { color: theme.color.onSurface, fontWeight: '800', fontSize: 14 },
  selectedSub: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  viewProfileBtn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  viewProfileText: { color: theme.color.onBrand, fontWeight: '800', fontSize: 12 },
  section: { paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '800', marginBottom: 10, letterSpacing: 0.4 },
  empty: { color: theme.color.onSurfaceTertiary, fontSize: 13 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.color.surfaceCard, borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md, paddingVertical: 10, paddingHorizontal: 14,
  },
  countryCode: { color: theme.color.brand, fontWeight: '800', fontSize: 12, width: 32 },
  countryName: { flex: 1, color: theme.color.onSurface, fontSize: 13, fontWeight: '600' },
  countryCount: { color: theme.color.onSurfaceTertiary, fontSize: 12, fontWeight: '700' },
});
