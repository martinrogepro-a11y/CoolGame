/**
 * Monetisation configuration. Replace every placeholder before release:
 *  - AdMob: create the app + ad units in https://admob.google.com (one set per platform).
 *  - RevenueCat: create the project, link App Store Connect / Play Console, copy public SDK keys.
 * The AdMob IDs below are Google's official *test* units: safe to ship in dev builds only.
 */
import { platform } from '../core/platform';

const TEST = {
  ios: { interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
  android: { interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
};

export const ADS = {
  /** Flip to false (and fill PROD) for store builds. */
  testing: true,
  prod: {
    ios: { interstitial: 'ca-app-pub-XXXXXXXX/IOS_INTERSTITIAL', rewarded: 'ca-app-pub-XXXXXXXX/IOS_REWARDED' },
    android: { interstitial: 'ca-app-pub-XXXXXXXX/ANDROID_INTERSTITIAL', rewarded: 'ca-app-pub-XXXXXXXX/ANDROID_REWARDED' },
  },
  /** Interstitial pacing: never during the first runs, never twice in a row, at most every N seconds. */
  minLifetimeRuns: 3,
  runsBetween: 2,
  minSecondsBetween: 150,
};

export function adUnit(kind: 'interstitial' | 'rewarded'): string {
  const p = platform === 'ios' ? 'ios' : 'android';
  return (ADS.testing ? TEST : ADS.prod)[p][kind];
}

export const IAP = {
  revenueCatKeys: { ios: 'appl_REPLACE_ME', android: 'goog_REPLACE_ME' },
  /** Entitlement identifiers configured in RevenueCat. */
  entitlements: { noAds: 'no_ads', patron: 'patron' },
  /** Store product identifiers (create identical IDs in both stores). */
  products: {
    noAds: 'tessera_no_ads',
    patron: 'tessera_patron',
    tesseraeS: 'tessera_tiles_small',
    tesseraeL: 'tessera_tiles_large',
  },
  /** Tesserae granted by consumable packs. */
  packs: { tessera_tiles_small: 400, tessera_tiles_large: 1500 } as Record<string, number>,
};
