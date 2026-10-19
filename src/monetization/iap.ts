import { isNative, platform } from '../core/platform';
import { grantSpread, persist, save } from '../meta/save';
import { IAP } from './config';

type PurchasesModule = typeof import('@revenuecat/purchases-capacitor');
type Pkg = Awaited<ReturnType<PurchasesModule['Purchases']['getOfferings']>>['all'][string]['availablePackages'][number];

let purchases: PurchasesModule['Purchases'] | null = null;
const packages = new Map<string, Pkg>();

export interface ShopItem {
  id: string;
  price: string;
}

/** Fallback prices shown in the web build and before the store answers. */
const FALLBACK: Record<string, string> = {
  [IAP.products.noAds]: '3,99 €',
  [IAP.products.patron]: '9,99 €',
  [IAP.products.tesseraeS]: '1,99 €',
  [IAP.products.tesseraeL]: '4,99 €',
};

function applyEntitlements(active: Record<string, unknown>) {
  save.purchases.noAds = save.purchases.noAds || IAP.entitlements.noAds in active || IAP.entitlements.patron in active;
  save.purchases.patron = save.purchases.patron || IAP.entitlements.patron in active;
  if (save.purchases.patron) for (const p of ['night', 'sakura', 'blueprint', 'dune']) if (!save.palettes.includes(p)) save.palettes.push(p);
  persist();
}

function grantProduct(id: string) {
  if (id === IAP.products.noAds) save.purchases.noAds = true;
  if (id === IAP.products.patron) applyEntitlements({ [IAP.entitlements.patron]: true });
  const pack = IAP.packs[id];
  if (pack) grantSpread(save, pack);
  persist(true);
}

export const iap = {
  async init() {
    if (!isNative) return;
    try {
      const mod = await import('@revenuecat/purchases-capacitor');
      purchases = mod.Purchases;
      const apiKey = platform === 'ios' ? IAP.revenueCatKeys.ios : IAP.revenueCatKeys.android;
      await purchases.configure({ apiKey });
      const { customerInfo } = await purchases.getCustomerInfo();
      applyEntitlements(customerInfo.entitlements.active);
      const offerings = await purchases.getOfferings();
      for (const p of offerings.current?.availablePackages ?? []) packages.set(p.product.identifier, p);
    } catch (e) {
      console.warn('[iap] init failed', e);
    }
  },

  price(id: string): string {
    return packages.get(id)?.product.priceString ?? FALLBACK[id] ?? '';
  },

  async buy(id: string): Promise<boolean> {
    if (!isNative) {
      // Web/dev build: simulate a successful purchase so the flow can be tested.
      if (!import.meta.env.DEV) return false;
      grantProduct(id);
      return true;
    }
    const pkg = packages.get(id);
    if (!purchases || !pkg) return false;
    try {
      const { customerInfo } = await purchases.purchasePackage({ aPackage: pkg });
      applyEntitlements(customerInfo.entitlements.active);
      if (IAP.packs[id]) grantProduct(id);
      return true;
    } catch {
      return false; // cancelled or failed
    }
  },

  async restore(): Promise<boolean> {
    if (!purchases) return false;
    try {
      const { customerInfo } = await purchases.restorePurchases();
      applyEntitlements(customerInfo.entitlements.active);
      return true;
    } catch {
      return false;
    }
  },
};
