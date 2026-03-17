import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familialmedia.familial',
  appName: 'familialapp',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
  },
};

export default config;
