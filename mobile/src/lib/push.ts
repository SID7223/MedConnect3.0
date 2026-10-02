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

// granted + whether the OS will still show the system prompt (after a hard
// denial the only way out is the phone's Settings app)
export async function getPushPermissionState(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const res = await Notifications.getPermissionsAsync();
    return { granted: res.status === 'granted', canAskAgain: res.canAskAgain !== false };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

type PermissionListener = (granted: boolean) => void;
const permissionListeners = new Set<PermissionListener>();

// broadcast permission changes so every surface showing notification state
// (Explore strip, NotifyPrompt, Profile toggle) stays in sync
export function onPushPermissionChange(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

export async function requestPushPermission(): Promise<boolean> {
  let granted = false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    granted = status === 'granted';
  } catch {
    granted = false;
  }
  permissionListeners.forEach((fn) => {
    try {
      fn(granted);
    } catch {
      // listener threw — keep notifying the rest
    }
  });
  return granted;
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
