import { CapacitorConfig } from '@capacitor/cli';

const isLiveReload = process.env.CAP_LIVE_RELOAD === 'true';

const config: CapacitorConfig = {
  appId: 'com.atlas.app',
  appName: 'A.T.L.A.S',
  webDir: 'dist',
  server: isLiveReload
    ? {
        androidScheme: 'https',
        iosScheme: 'https',
        url: 'http://localhost:5174',
        cleartext: true
      }
    : undefined,
  ios: {
    contentInset: 'always',
    backgroundColor: '#00051E',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#00051E',
      showSpinner: true,
      spinnerColor: '#FF1801',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#00051E'
    },
  },
};

export default config;