import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rarityColor, theme } from '@/src/theme';

export function RarityBadge({ rarity, size = 'md' }: { rarity: string; size?: 'sm' | 'md' }) {
  const color = rarityColor(rarity);
  const small = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${color}26`, borderColor: `${color}55` },
        small && styles.badgeSmall,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, small && styles.textSmall]}>
        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  badgeSmall: { paddingVertical: 3, paddingHorizontal: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  textSmall: { fontSize: 10 },
});
