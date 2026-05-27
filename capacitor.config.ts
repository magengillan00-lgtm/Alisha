import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alisha.app',
  appName: 'أليشا - Alisha',
  webDir: 'out',
  server: {
    // When running as native app, use the remote server for API calls
    // The static assets are served from the app bundle
    // API calls (/api/*) are proxied to the remote server
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f0a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f0a1a',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f0a1a',
  },
};

export default config;
