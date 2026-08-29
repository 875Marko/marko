import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ApiError, ScanApi } from '@/src/api/client';
import { useToast } from '@/src/ui/Toast';
import { useAuth } from '@/src/auth/AuthContext';
import { setLastScanResult } from '@/src/state/scanResultStore';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runScan = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      toast.show('Could not read that image, try another', 'error');
      return;
    }
    setPreviewUri(asset.uri);
    setBusy(true);
    try {
      const result = await ScanApi.scan({ image_base64: asset.base64 });
      setLastScanResult(result);
      refreshUser();
      router.push('/result');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Scan failed. Try again.';
      toast.show(message, 'error');
    } finally {
      setBusy(false);
      setPreviewUri(null);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show('Permission needed to continue', 'error');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (result.canceled || !result.assets?.[0]) return;
    await runScan(result.assets[0]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.kicker}>SCAN. COLLECT. COMPETE.</Text>
      <Text style={styles.title}>Spot a car</Text>
      <Text style={styles.subtitle}>Snap or upload a clear photo and let the AI identify it.</Text>

      <View style={styles.previewFrame}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={styles.previewEmpty}>
            <Ionicons name="car-sport-outline" size={48} color={theme.color.onSurfaceTertiary} />
          </View>
        )}
        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={theme.color.onSurface} size="large" />
            <Text style={styles.busyText}>Identifying car…</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {Platform.OS !== 'web' && (
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => pick('camera')}
            disabled={busy}
          >
            <Ionicons name="camera" size={18} color={theme.color.onBrand} style={styles.ctaIcon} />
            <Text style={styles.ctaText}>Take Photo</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.85 }]}
          onPress={() => pick('library')}
          disabled={busy}
        >
          <Ionicons name="images" size={18} color={theme.color.onSurface} style={styles.ctaIcon} />
          <Text style={styles.secondaryCtaText}>Choose from Library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface, paddingHorizontal: theme.spacing.xl },
  kicker: { color: theme.color.brand, fontSize: 12, letterSpacing: 3, fontWeight: '700', marginTop: 8 },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
  previewFrame: {
    flex: 1,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceCard,
    overflow: 'hidden',
  },
  preview: { flex: 1 },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,17,21,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  busyText: { color: theme.color.onSurface, fontWeight: '600' },
  actions: { gap: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: theme.radius.lg,
  },
  ctaIcon: { marginRight: 10 },
  ctaText: { color: theme.color.onBrand, fontSize: 16, fontWeight: '800' },
  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.color.surfaceRaised, paddingVertical: 16, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.color.border,
  },
  secondaryCtaText: { color: theme.color.onSurface, fontSize: 16, fontWeight: '700' },
});
