import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, AtlasApi, AtlasCountry, GlobePin } from '@/src/api/client';
import { Globe } from '@/src/ui/Globe';
import { RarityBadge } from '@/src/ui/RarityBadge';
import { useToast } from '@/src/ui/Toast';

export default function AtlasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();

  const [mine, setMine] = useState<GlobePin[]>([]);
  const [friends, setFriends] = useState<GlobePin[]>([]);
  const [countries, setCountries] = useState<AtlasCountry[] | null>(null);
  const [selected, setSelected] = useState<{ pin: GlobePin; source: 'mine' | 'friends' } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [globeRes, atlasRes] = await Promise.all([AtlasApi.globe(), AtlasApi.get()]);
      setMine(globeRes.mine);
      setFriends(globeRes.friends);
      setCountries(atlasRes.countries);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : 'Could not load the atlas', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkerPress = (id: string, source: 'mine' | 'friends') => {
    const pool = source === 'mine' ? mine : friends;
    const pin = pool.find((p) => p.scan_id === id);
    if (pin) setSelected({ pin, source });
  };

  const globeSize = Math.min(340, width - theme.spacing.xl * 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.color.onSurface} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>Atlas</Text>
        <Text style={styles.subtitle}>Where you — and your friends — have been spotting</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.color.brand} style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={styles.globeWrap}>
            <Globe
              size={globeSize}
              mine={mine.map((p) => ({ id: p.scan_id, lat: p.latitude, lng: p.longitude }))}
              friends={friends.map((p) => ({ id: p.scan_id, lat: p.latitude, lng: p.longitude }))}
              onMarkerPress={handleMarkerPress}
            />
          </View>

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
          <Text style={styles.hint}>Drag to rotate the globe · tap a pin for details</Text>

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
                <Pressable
                  style={styles.viewProfileBtn}
                  onPress={() => router.push(`/profile/${selected.pin.user_id}`)}
                >
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  headerRow: { paddingHorizontal: theme.spacing.xl },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: theme.color.onSurface, fontSize: 14, fontWeight: '600', marginLeft: 2 },
  titleWrap: { paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg },
  title: { color: theme.color.onSurface, fontSize: 26, fontWeight: '900' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 4 },
  globeWrap: { alignItems: 'center', marginBottom: theme.spacing.md },
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
  section: { paddingHorizontal: theme.spacing.xl },
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
