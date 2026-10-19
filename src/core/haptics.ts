import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

let enabled = true;
let lastTick = 0;

export const haptics = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  /** Very light tick, rate-limited so drawing long belts stays pleasant. */
  tick() {
    const now = performance.now();
    if (!enabled || now - lastTick < 45) return;
    lastTick = now;
    if (isNative) void Haptics.selectionChanged().catch(() => {});
    else navigator.vibrate?.(4);
  },
  light() {
    if (!enabled) return;
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else navigator.vibrate?.(8);
  },
  medium() {
    if (!enabled) return;
    if (isNative) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else navigator.vibrate?.(15);
  },
  success() {
    if (!enabled) return;
    if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else navigator.vibrate?.([10, 40, 10]);
  },
  warning() {
    if (!enabled) return;
    if (isNative) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else navigator.vibrate?.([20, 60, 20]);
  },
};
