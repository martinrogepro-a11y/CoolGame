import { isNative } from './platform';

/**
 * Platform services around the game: store review prompt, local notifications and
 * native sharing. Every call degrades gracefully on the web build.
 */

export const review = {
  /** Asks the store for its native rating sheet (the OS decides whether to show it). */
  async request() {
    if (!isNative) return;
    try {
      const { InAppReview } = await import('@capacitor-community/in-app-review');
      await InAppReview.requestReview();
    } catch {
      /* not available */
    }
  },
};

const DAILY_ID = 1001;
const STREAK_ID = 1002;

export const notifications = {
  /** Requests permission; returns true if granted. Ask after a happy moment, never at launch. */
  async enable(): Promise<boolean> {
    if (!isNative) return false;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const p = await LocalNotifications.requestPermissions();
      return p.display === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Schedules the two gentle reminders: the daily puzzle in the morning, and a streak
   * reminder in the evening (rescheduled each launch so it never fires after playing).
   */
  async schedule(texts: { dailyTitle: string; dailyBody: string; streakTitle: string; streakBody: string }, playedToday: boolean) {
    if (!isNative) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }, { id: STREAK_ID }] });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 7, 0, 0);
      const evening = new Date();
      evening.setHours(19, 30, 0, 0);
      if (playedToday || evening.getTime() < Date.now()) evening.setDate(evening.getDate() + 1);
      await LocalNotifications.schedule({
        notifications: [
          { id: DAILY_ID, title: texts.dailyTitle, body: texts.dailyBody, schedule: { at: tomorrow, allowWhileIdle: true } },
          { id: STREAK_ID, title: texts.streakTitle, body: texts.streakBody, schedule: { at: evening, allowWhileIdle: true } },
        ],
      });
    } catch {
      /* permission missing */
    }
  },

  async disable() {
    if (!isNative) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }, { id: STREAK_ID }] });
    } catch {
      /* ignore */
    }
  },
};

/** Shares text through the native sheet, the Web Share API, or the clipboard. Returns how it went. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNative) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch {
    /* cancelled or blocked: fall back to the clipboard */
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
