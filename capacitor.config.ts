import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luminous.exam',
  appName: 'Luminous Exam',
  webDir: 'out',
  server: {
    url: 'http://10.0.2.2:3001',
    cleartext: true
  }
};

export default config;
