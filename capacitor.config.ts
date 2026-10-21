import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.canalia.game',
  appName: 'Canalia',
  webDir: 'dist',
  backgroundColor: '#F2ECE2',
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#F2ECE2', showSpinner: false },
  },
};

export default config;
