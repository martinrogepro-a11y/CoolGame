import '@fontsource-variable/fraunces';
import './styles.css';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './core/platform';
import { paletteById } from './game/content';
import { loadSave, persist, save } from './meta/save';
import { ads } from './monetization/ads';
import { iap } from './monetization/iap';
import { App } from './ui/app';
import { scheduleReminders } from './ui/puzzleMode';

async function boot() {
  await loadSave();
  new App(document.getElementById('app')!);
  if (isNative) {
    const pal = paletteById(save.palette);
    void StatusBar.setStyle({ style: pal.dark ? Style.Dark : Style.Light }).catch(() => {});
    void SplashScreen.hide().catch(() => {});
    // Save when the app goes to background: the OS may kill it without warning.
    void CapApp.addListener('pause', () => persist(true));
  }
  window.addEventListener('pagehide', () => persist(true));
  // Monetisation SDKs load after first paint so they never delay the game.
  setTimeout(() => {
    void ads.init();
    void iap.init();
    // Reminders are rescheduled on every launch so they always point at tomorrow.
    if (save.settings.notifications) void scheduleReminders();
  }, 300);
}

void boot();
