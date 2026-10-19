import { Preferences } from '@capacitor/preferences';
import { isNative } from './platform';

/**
 * Key/value persistence. Native builds use Capacitor Preferences (survives WebView
 * storage eviction on iOS); the web build falls back to localStorage.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isNative) return (await Preferences.get({ key })).value;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isNative) await Preferences.set({ key, value });
      else localStorage.setItem(key, value);
    } catch {
      /* storage full or unavailable: the game keeps running from memory */
    }
  },
};
