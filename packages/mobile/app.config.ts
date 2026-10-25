import type { ExpoConfig } from 'expo/config';

const healthShare = 'Mile Quest reads walking and running workouts so your team can count that distance toward its goal.';
const healthUpdate = 'Mile Quest does not write health data. HealthKit asks for this description because the app is allowed to request Health access.';

const config: ExpoConfig = {
  name: 'Mile Quest',
  slug: 'mile-quest',
  scheme: 'milequest',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.milequest.app',
    supportsTablet: false,
    infoPlist: {
      NSHealthShareUsageDescription: healthShare,
      NSHealthUpdateUsageDescription: healthUpdate,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.milequest.app',
    permissions: [
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_EXERCISE',
    ],
  },
  plugins: [
    'expo-dev-client',
    'expo-router',
    'expo-secure-store',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription: healthShare,
        NSHealthUpdateUsageDescription: healthUpdate,
        background: false,
      },
    ],
    'react-native-health-connect',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiBaseUrl: 'https://mile-quest.vercel.app',
  },
};

export default config;
