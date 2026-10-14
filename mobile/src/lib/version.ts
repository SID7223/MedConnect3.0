import Constants from 'expo-constants';

// The real build number: the native versionName on device (e.g. "1.0.6"),
// falling back to the Expo config version in dev/Expo Go, then the floor.
export const APP_VERSION: string =
  Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '1.0.0';
