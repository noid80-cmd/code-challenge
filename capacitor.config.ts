import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.choekyun.ios',
  appName: '초견챌린지',
  webDir: 'out',
  server: {
    url: 'https://code-challenge-smoky-seven.vercel.app',
    cleartext: false
  }
};

export default config;
