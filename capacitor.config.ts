import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.mixxermannipro.openhealth',
  appName: 'KADENZ',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'kadenz.local',
  },
  android: {
    backgroundColor: '#090A0C',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
