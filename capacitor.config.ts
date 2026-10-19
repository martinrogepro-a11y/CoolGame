import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tessera.game',
  appName: 'Tessera',
  webDir: 'dist',
  backgroundColor: '#F2ECE2',
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#F2ECE2', showSpinner: false },
  },
};

export default config;
