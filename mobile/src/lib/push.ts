import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Local notifications (port of the web push opt-in in Profile.jsx). The server
// only supports web-push (VAPID) subscriptions, so on mobile we request the
// OS permission and show local notifications for new messages while the app runs.

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

// Show notifications even while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getPushPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // permission denied or channel unavailable
  }
}

export async function sendTestNotification(): Promise<void> {
  await sendLocalNotification(
    'MedConnect local test 🔔',
    'If you see THIS, your device can show notifications. (This is a local test.)'
  );
}
