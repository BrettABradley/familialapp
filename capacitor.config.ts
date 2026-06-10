import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familialmedia.familial',
  appName: 'Familial',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Safety cap only — we hide manually after React's first paint.
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    // iOS-specific settings. backgroundColor pins the WKWebView backing
    // to white so there is no black flash during the splash→app handoff.
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
  android: {
    // Match the JS bundle's HTTPS-only posture. The post-sync script also
    // sets android:usesCleartextTraffic="false" on the manifest.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
