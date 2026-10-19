/**
 * Analytics facade. Every gameplay moment worth measuring goes through `track`, so plugging
 * Firebase Analytics or GameAnalytics later is a one-file change. Until then events are kept
 * in a small local ring buffer (handy for debugging) and printed in development.
 */

export type EventName =
  | 'level_start'
  | 'level_complete'
  | 'level_quit'
  | 'hint_used'
  | 'daily_complete'
  | 'share'
  | 'chest_open'
  | 'album_complete'
  | 'notif_opt_in'
  | 'ad_watched'
  | 'iap_purchase';

type Props = Record<string, string | number | boolean>;

const buffer: { e: EventName; p: Props; t: number }[] = [];
let sink: ((e: EventName, p: Props) => void) | null = null;

export const analytics = {
  /** Connects a real provider (e.g. Firebase `logEvent`). */
  setSink(fn: (e: EventName, p: Props) => void) {
    sink = fn;
    for (const ev of buffer.splice(0)) fn(ev.e, ev.p);
  },
  track(e: EventName, p: Props = {}) {
    if (sink) sink(e, p);
    else {
      buffer.push({ e, p, t: Date.now() });
      if (buffer.length > 200) buffer.shift();
    }
    if (import.meta.env.DEV) console.debug('[analytics]', e, p);
  },
};
