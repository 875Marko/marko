import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function FactCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.factCell}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value ?? '—'}</Text>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function RarityGrid({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <View style={styles.rarityGrid}>
      {Object.entries(breakdown).map(([rarity, count]) => (
        <View key={rarity} style={styles.rarityCell}>
          <Text style={styles.rarityCount}>{count}</Text>
          <Text style={styles.rarityLabel}>{rarity}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statTile: {
    flex: 1, alignItems: 'center', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border, paddingVertical: theme.spacing.md,
  },
  statValue: { color: theme.color.brand, fontSize: 20, fontWeight: '900' },
  statLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '800', marginBottom: 8, letterSpacing: 0.4 },
  factCell: {
    flex: 1, minWidth: '46%', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md,
  },
  factLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginBottom: 4 },
  factValue: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  rarityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  rarityCell: {
    minWidth: 64, alignItems: 'center', backgroundColor: theme.color.surfaceCard, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, paddingVertical: 10, paddingHorizontal: 12,
  },
  rarityCount: { color: theme.color.onSurface, fontWeight: '800', fontSize: 15 },
  rarityLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
});
