import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gitcity.social',
  appName: 'GitSocial',
  webDir: 'out',
  // Set default background color of the native webview to avoid the white flash on load
  backgroundColor: '#060814',
  server: {
    // Local network URL to connect the phone to the development server running on your PC
    url: 'http://localhost:3001',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false, // Prevents splash screen from hiding before web assets compile/load
      backgroundColor: '#060814',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#c8e64a'
    }
  }
};

export default config;
