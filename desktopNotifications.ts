export const DESKTOP_NOTIFICATIONS_ENABLED_KEY = 'print_calc_desktop_notifications_enabled';

export function isDesktopNotificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof window.Notification === 'function'
  );
}

export function getDesktopNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDesktopNotificationsSupported()) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export function isDesktopNotificationsEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return true;
    }
    return localStorage.getItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setDesktopNotificationsEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // ignore storage errors
  }
}

export async function requestDesktopNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isDesktopNotificationsSupported()) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted') {
      setDesktopNotificationsEnabled(true);
    }
    return result;
  } catch {
    return getDesktopNotificationPermission();
  }
}

export function showDesktopNotification(options: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}): boolean {
  if (
    !isDesktopNotificationsSupported() ||
    getDesktopNotificationPermission() !== 'granted' ||
    !isDesktopNotificationsEnabled()
  ) {
    return false;
  }

  try {
    const n = new window.Notification(options.title, {
      body: options.body,
      tag: options.tag || undefined,
    });
    n.onclick = () => {
      try {
        window.focus();
        options.onClick?.();
        n.close();
      } catch {
        // ignore focus/close errors
      }
    };
    return true;
  } catch {
    return false;
  }
}
