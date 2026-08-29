import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { RarityBadge } from '@/src/ui/RarityBadge';
import { takeLastScanResult } from '@/src/state/scanResultStore';

export default function ResultModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [result] = useState(() => takeLastScanResult());

  if (!result) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.emptyText}>No scan to show.</Text>
        <Pressable style={styles.closeCta} onPress={() => router.back()}>
          <Text style={styles.closeCtaText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const facts: [string, string | null][] = [
    ['Engine', result.engine],
    ['Top speed', result.top_speed_kmh ? `${result.top_speed_kmh} km/h` : null],
    ['Origin', result.country_origin],
    ['Years', result.production_years],
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${result.image_base64}` }}
            style={styles.image}
            contentFit="cover"
          />
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={theme.color.onSurface} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <RarityBadge rarity={result.rarity} />
          <Text style={styles.title}>{result.make} {result.model}</Text>
          {!!result.year && <Text style={styles.year}>{result.year}</Text>}

          <View style={styles.pointsRow}>
            <Ionicons name="sparkles" size={16} color={theme.color.brand} />
            <Text style={styles.pointsText}>
              +{result.points - result.bonus_points} pts
              {result.bonus_points > 0 ? `  +${result.bonus_points} bonus` : ''}
            </Text>
          </View>

          {!!result.reason && <Text style={styles.reason}>{result.reason}</Text>}

          {result.completed_achievements.length > 0 && (
            <View style={styles.achievements}>
              {result.completed_achievements.map((a) => (
                <View key={a.id} style={styles.achievementPill}>
                  <Ionicons name="ribbon" size={14} color={theme.color.warning} />
                  <Text style={styles.achievementText}>{a.title} +{a.bonus}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.factsGrid}>
            {facts
              .filter(([, value]) => !!value)
              .map(([label, value]) => (
                <View key={label} style={styles.factCell}>
                  <Text style={styles.factLabel}>{label}</Text>
                  <Text style={styles.factValue}>{value}</Text>
                </View>
              ))}
          </View>

          {!!result.fun_fact && (
            <View style={styles.funFactCard}>
              <Ionicons name="bulb-outline" size={16} color={theme.color.onSurfaceSecondary} />
              <Text style={styles.funFactText}>{result.fun_fact}</Text>
            </View>
          )}

          <Pressable style={styles.closeCta} onPress={() => router.back()}>
            <Text style={styles.closeCtaText}>Nice catch!</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.color.onSurfaceSecondary, marginBottom: theme.spacing.lg },
  imageWrap: { width: '100%', height: 280 },
  image: { width: '100%', height: '100%' },
  closeButton: {
    position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(15,17,21,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: theme.spacing.xl },
  title: { color: theme.color.onSurface, fontSize: 28, fontWeight: '900', marginTop: theme.spacing.sm },
  year: { color: theme.color.onSurfaceTertiary, fontSize: 14, marginTop: 2 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.md },
  pointsText: { color: theme.color.onSurface, fontWeight: '800', fontSize: 15 },
  reason: { color: theme.color.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: theme.spacing.md },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  achievementPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,194,75,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,194,75,0.4)', borderRadius: theme.radius.pill,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  achievementText: { color: theme.color.warning, fontSize: 12, fontWeight: '700' },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  factCell: {
    minWidth: '46%', flexGrow: 1, backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md,
  },
  factLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginBottom: 4 },
  factValue: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700' },
  funFactCard: {
    flexDirection: 'row', gap: 10, backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md, marginTop: theme.spacing.lg,
  },
  funFactText: { flex: 1, color: theme.color.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  closeCta: {
    backgroundColor: theme.color.brand, borderRadius: theme.radius.lg, paddingVertical: 16,
    alignItems: 'center', marginTop: theme.spacing.xl,
  },
  closeCtaText: { color: theme.color.onBrand, fontWeight: '800', fontSize: 16 },
});
