import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familialmedia.familial',
  appName: 'familialapp',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
    },
  },
};

export default config;
