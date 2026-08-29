import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/src/theme';
import { RarityBadge } from '@/src/ui/RarityBadge';

interface ScanCardProps {
  imageBase64?: string | null;
  title: string;
  subtitle?: string | null;
  rarity: string;
  points: number;
  onPress?: () => void;
}

export function ScanCard({ imageBase64, title, subtitle, rarity, points, onPress }: ScanCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? { opacity: 0.85 } : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.thumbWrap}>
        {imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
        <View style={styles.metaRow}>
          <RarityBadge rarity={rarity} size="sm" />
          <Text style={styles.points}>+{points} pts</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.color.surfaceCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  thumbWrap: { borderRadius: theme.radius.md, overflow: 'hidden' },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.md },
  thumbFallback: { backgroundColor: theme.color.surfaceRaised },
  info: { flex: 1, gap: 4 },
  title: { color: theme.color.onSurface, fontSize: 15, fontWeight: '800' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  points: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '700' },
});
