export const theme = {
  color: {
    brand: '#FF5A36',
    onBrand: '#14100D',

    surface: '#0F1115',
    surfaceRaised: '#1C1F26',
    surfaceCard: 'rgba(28,31,38,0.92)',

    onSurface: '#F5F6F8',
    onSurfaceSecondary: '#B7BCC7',
    onSurfaceTertiary: '#7B8290',

    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',

    success: '#3DD68C',
    warning: '#FFC24B',
    error: '#FF5C5C',

    rarity: {
      common: '#8A93A6',
      uncommon: '#3DD68C',
      rare: '#4FA0FF',
      epic: '#B36BFF',
      legendary: '#FFC24B',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
} as const;

export type RarityKey = keyof typeof theme.color.rarity;

export function rarityColor(rarity: string): string {
  return (theme.color.rarity as Record<string, string>)[rarity] ?? theme.color.rarity.common;
}
