import React, { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '@/src/theme';
import { buildLeafletHtml, MapPin } from '@/src/lib/leafletHtml';

interface RegionMapProps {
  pins: MapPin[];
  onOpenProfile?: (userId: string) => void;
}

export function RegionMap({ pins, onOpenProfile }: RegionMapProps) {
  const html = useMemo(() => buildLeafletHtml(pins), [pins]);

  return (
    <View style={{ flex: 1, borderRadius: theme.radius.xl, overflow: 'hidden' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: theme.color.surface }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === 'openProfile' && data.userId) onOpenProfile?.(data.userId);
          } catch {
            // Ignore malformed messages.
          }
        }}
      />
    </View>
  );
}
