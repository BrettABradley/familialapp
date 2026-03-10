import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f745440093af4f4390a60d52ff08c778',
  appName: 'familialapp',
  webDir: 'dist',
  server: {
    url: 'https://f7454400-93af-4f43-90a6-0d52ff08c778.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#FFFFFF',
      showSpinner: true,
      spinnerColor: '#1a1a2e',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
