import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luminous.exam',
  appName: 'Luminous Exam',
  webDir: 'out',
  server: {
    url: 'https://exam.luminouscentree.com',
    allowNavigation: ['exam.luminouscentree.com', '*.luminouscentree.com'],
    cleartext: true
  }
};

export default config;
