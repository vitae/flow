import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pro.gwdf.flow',
  appName: 'Flow AI',
  webDir: 'out',
  server: {
    // In dev, point to Next.js dev server
    // url: 'http://localhost:3000',
    // cleartext: true,

    // In production, serve from the built static export
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    scheme: 'Flow AI',
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Filesystem: {
      permissions: ['publicStorage'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: true,
      spinnerColor: '#00FF00',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
  },
};

export default config;
