import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alisha.ai',
  appName: 'Alisha',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
