import React, { useEffect, useMemo, useRef } from 'react';
import { theme } from '@/src/theme';
import { buildLeafletHtml, MapPin } from '@/src/lib/leafletHtml';

interface RegionMapProps {
  pins: MapPin[];
  onOpenProfile?: (userId: string) => void;
}

export function RegionMap({ pins, onOpenProfile }: RegionMapProps) {
  const html = useMemo(() => buildLeafletHtml(pins), [pins]);
  const onOpenProfileRef = useRef(onOpenProfile);
  onOpenProfileRef.current = onOpenProfile;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'openProfile' && data.userId) onOpenProfileRef.current?.(data.userId);
      } catch {
        // Ignore messages that aren't ours.
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      title="Region map"
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: theme.radius.xl, backgroundColor: theme.color.surface }}
    />
  );
}
