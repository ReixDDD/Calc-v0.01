import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_NOTIFICATIONS_ENABLED_KEY,
  getDesktopNotificationPermission,
  isDesktopNotificationsEnabled,
  isDesktopNotificationsSupported,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
  showDesktopNotification,
} from './desktopNotifications';

test('desktopNotifications gracefully handles unsupported Node environment without window.Notification', async () => {
  const origWindow = (globalThis as Record<string, unknown>).window;
  try {
    delete (globalThis as Record<string, unknown>).window;
    assert.equal(isDesktopNotificationsSupported(), false);
    assert.equal(getDesktopNotificationPermission(), 'unsupported');
    assert.equal(await requestDesktopNotificationPermission(), 'unsupported');
    assert.equal(
      showDesktopNotification({
        title: 'CRM Типография — Заказ №1001',
        body: 'Новый заказ',
        tag: 'crm-notif-1',
      }),
      false
    );
  } finally {
    if (origWindow !== undefined) {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  }
});

test('desktopNotifications creates Notification when granted and enabled, and respects disable toggle', async () => {
  const origWindow = (globalThis as Record<string, unknown>).window;
  const origLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  const storageMap = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
    setItem: (key: string, val: string) => {
      storageMap.set(key, String(val));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
  };

  const createdNotifications: Array<{
    title: string;
    options?: NotificationOptions;
    onclick: (() => void) | null;
    closed: boolean;
  }> = [];
  let focusedCount = 0;

  class FakeNotification {
    static permission: NotificationPermission = 'granted';
    static async requestPermission(): Promise<NotificationPermission> {
      FakeNotification.permission = 'granted';
      return 'granted';
    }
    title: string;
    options?: NotificationOptions;
    onclick: (() => void) | null = null;
    closed = false;

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options;
      createdNotifications.push(this);
    }

    close() {
      this.closed = true;
    }
  }

  try {
    (globalThis as Record<string, unknown>).localStorage = fakeLocalStorage;
    (globalThis as Record<string, unknown>).window = {
      Notification: FakeNotification,
      focus: () => {
        focusedCount += 1;
      },
    };

    assert.equal(isDesktopNotificationsSupported(), true);
    assert.equal(getDesktopNotificationPermission(), 'granted');
    assert.equal(isDesktopNotificationsEnabled(), true);

    let clicked = false;
    const shown = showDesktopNotification({
      title: 'CRM Типография — Заказ №1005',
      body: 'Заказ №1005 переведён в статус «В работе» (ООО Альфа)',
      tag: 'crm-notif-evt_1005',
      onClick: () => {
        clicked = true;
      },
    });

    assert.equal(shown, true);
    assert.equal(createdNotifications.length, 1);
    assert.equal(createdNotifications[0].title, 'CRM Типография — Заказ №1005');
    assert.equal(
      createdNotifications[0].options?.body,
      'Заказ №1005 переведён в статус «В работе» (ООО Альфа)'
    );
    assert.equal(createdNotifications[0].options?.tag, 'crm-notif-evt_1005');

    // Simulate user clicking the Windows notification toast
    createdNotifications[0].onclick?.();
    assert.equal(focusedCount, 1);
    assert.equal(clicked, true);
    assert.equal(createdNotifications[0].closed, true);

    // Disable notifications via setDesktopNotificationsEnabled(false)
    setDesktopNotificationsEnabled(false);
    assert.equal(storageMap.get(DESKTOP_NOTIFICATIONS_ENABLED_KEY), 'false');
    assert.equal(isDesktopNotificationsEnabled(), false);

    const shownWhenDisabled = showDesktopNotification({
      title: 'CRM Типография — Заказ №1006',
      body: 'Не должен показаться',
    });
    assert.equal(shownWhenDisabled, false);
    assert.equal(createdNotifications.length, 1);

    // Requesting permission when granted re-enables notifications
    const perm = await requestDesktopNotificationPermission();
    assert.equal(perm, 'granted');
    assert.equal(isDesktopNotificationsEnabled(), true);
  } finally {
    if (origWindow !== undefined) {
      (globalThis as Record<string, unknown>).window = origWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (origLocalStorage !== undefined) {
      (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
});
