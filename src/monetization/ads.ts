import { isNative } from '../core/platform';
import { save, persist } from '../meta/save';
import { ADS, adUnit } from './config';

type AdMobModule = typeof import('@capacitor-community/admob');
let admob: AdMobModule['AdMob'] | null = null;
let ready = false;
let rewardedLoaded = false;
let interstitialLoaded = false;

/** Development stand-in so the full flow is testable in a browser. */
function fakeAd(label: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fake-ad';
    el.innerHTML = `<div><b>${label}</b><small>Ad placeholder (web build)</small><button>Close</button></div>`;
    document.body.appendChild(el);
    el.querySelector('button')!.addEventListener('click', () => {
      el.remove();
      resolve(true);
    });
  });
}

async function preload() {
  if (!admob) return;
  try {
    if (!rewardedLoaded) {
      await admob.prepareRewardVideoAd({ adId: adUnit('rewarded') });
      rewardedLoaded = true;
    }
  } catch {
    rewardedLoaded = false;
  }
  try {
    if (!interstitialLoaded && !save.purchases.noAds) {
      await admob.prepareInterstitial({ adId: adUnit('interstitial') });
      interstitialLoaded = true;
    }
  } catch {
    interstitialLoaded = false;
  }
}

export const ads = {
  async init() {
    if (!isNative) {
      ready = true;
      return;
    }
    try {
      const mod = await import('@capacitor-community/admob');
      admob = mod.AdMob;
      await admob.initialize({ initializeForTesting: ADS.testing });
      // GDPR / UMP consent (required in the EU/UK) and iOS App Tracking Transparency.
      const consent = await admob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === mod.AdmobConsentStatus.REQUIRED) {
        await admob.showConsentForm();
      }
      try {
        const att = await admob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await admob.requestTrackingAuthorization();
      } catch {
        /* Android: no ATT */
      }
      ready = true;
      void preload();
    } catch (e) {
      console.warn('[ads] init failed', e);
    }
  },

  async showPrivacyOptions() {
    try {
      await admob?.showPrivacyOptionsForm();
    } catch {
      /* not required in this region */
    }
  },

  rewardedAvailable(): boolean {
    return ready && (!isNative || rewardedLoaded);
  },

  /** Shows a rewarded video. Resolves true only if the reward was earned. */
  async rewarded(label: string): Promise<boolean> {
    if (!isNative) return fakeAd(label);
    if (!admob || !rewardedLoaded) {
      void preload();
      return false;
    }
    try {
      rewardedLoaded = false;
      const reward = await admob.showRewardVideoAd();
      return !!reward;
    } catch {
      return false;
    } finally {
      void preload();
    }
  },

  /** Called after each run; shows an interstitial only if pacing rules allow it. */
  async maybeInterstitial(): Promise<void> {
    const a = save.ads;
    a.runsSinceInterstitial++;
    persist();
    if (save.purchases.noAds || save.purchases.patron) return;
    if (save.runs < ADS.minLifetimeRuns) return;
    if (a.runsSinceInterstitial < ADS.runsBetween) return;
    if (Date.now() - a.lastInterstitial < ADS.minSecondsBetween * 1000) return;
    a.runsSinceInterstitial = 0;
    a.lastInterstitial = Date.now();
    persist();
    if (!isNative) {
      if (import.meta.env.DEV) await fakeAd('Interstitial');
      return;
    }
    if (!admob || !interstitialLoaded) return void preload();
    try {
      interstitialLoaded = false;
      await admob.showInterstitial();
    } catch {
      /* no fill */
    } finally {
      void preload();
    }
  },
};
