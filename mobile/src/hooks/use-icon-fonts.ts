import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

/** Returns [loaded, error] — mirrors expo-font's useFonts tuple so callers
 * can gate the splash screen on icon glyphs being ready. */
export function useIconFonts() {
  return useFonts({
    ...Ionicons.font,
  });
}
