import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.christcollective.app',
  appName: 'Christ Collective',
  webDir: 'dist/public',
  plugins: {
    // Show pushes as a banner (with sound and badge) even while the app is open; iOS hides them otherwise
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
