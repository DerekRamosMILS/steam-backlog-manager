/**
 * secureTokenService — encrypted on-device storage for platform credentials.
 *
 * Currently holds only the user's own Steam Web API key. Uses expo-secure-store
 * (Keychain on iOS, EncryptedSharedPreferences on Android). Nothing is uploaded.
 */

import * as SecureStore from 'expo-secure-store';
import type { ImportPlatform } from '../types';

function key(platform: ImportPlatform, tokenType: string): string {
  return `${platform}_${tokenType}`;
}

export async function getToken(
  platform: ImportPlatform,
  tokenType: string
): Promise<string | null> {
  return SecureStore.getItemAsync(key(platform, tokenType));
}

export async function setToken(
  platform: ImportPlatform,
  tokenType: string,
  value: string
): Promise<void> {
  await SecureStore.setItemAsync(key(platform, tokenType), value);
}

export async function clearTokens(platform: ImportPlatform): Promise<void> {
  const keys = ['api_key'];
  await Promise.all(
    keys.map((k) => SecureStore.deleteItemAsync(key(platform, k)).catch(() => {}))
  );
}
