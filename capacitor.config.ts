import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atlas.app',
  appName: 'A.T.L.A.S',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    url: 'http://localhost:5174',
    cleartext: true
  },
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