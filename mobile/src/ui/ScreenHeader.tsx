import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.lg },
  title: { color: theme.color.onSurface, fontSize: 26, fontWeight: '900' },
  subtitle: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 4 },
});
