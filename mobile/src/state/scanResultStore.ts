import type { ScanResult } from '@/src/api/client';

// expo-router params are meant for small strings, not a full scan payload
// (base64 image included) — a module-level handoff avoids serializing it.
let lastResult: ScanResult | null = null;

export function setLastScanResult(result: ScanResult) {
  lastResult = result;
}

export function takeLastScanResult(): ScanResult | null {
  const result = lastResult;
  lastResult = null;
  return result;
}
