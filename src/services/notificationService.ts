/**
 * notificationService — local-only reminders.
 *
 * Everything is scheduled on-device; there is no push server and no remote token.
 * Reminders are rebuilt from scratch on each sync so they always reflect current data.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getAllGames, getSetting, setSetting } from '../database/queries';
import { getCurrentMonthChallenges } from './challengeService';
import { Language, t } from '../i18n';

export const NOTIFICATIONS_SETTING_KEY = 'notifications_enabled';

const ANDROID_CHANNEL_ID = 'backlogflow-reminders';
const STALE_AFTER_DAYS = 7;
const REMINDER_HOUR = 19;
const CHALLENGE_REMINDER_DAY = 25;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function areNotificationsEnabled(): boolean {
  return getSetting(NOTIFICATIONS_SETTING_KEY) === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  setSetting(NOTIFICATIONS_SETTING_KEY, enabled ? 'true' : 'false');
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 200],
  });
}

/** Ask for permission. Returns whether we ended up with it. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureAndroidChannel();
    return true;
  }
  if (!current.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  if (asked.granted) await ensureAndroidChannel();
  return asked.granted;
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Next occurrence of REMINDER_HOUR that is at least `minDaysAhead` days out. */
function nextReminderDate(minDaysAhead: number): Date {
  const when = new Date();
  when.setDate(when.getDate() + minDaysAhead);
  when.setHours(REMINDER_HOUR, 0, 0, 0);
  if (when.getTime() <= Date.now()) {
    when.setDate(when.getDate() + 1);
  }
  return when;
}

/**
 * Rebuild the scheduled reminders from current data.
 * Safe to call on every app open — it cancels before it schedules.
 */
export async function syncReminders(lang: Language): Promise<void> {
  if (!areNotificationsEnabled()) {
    await cancelAllReminders();
    return;
  }

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    await cancelAllReminders();
    return;
  }

  await ensureAndroidChannel();
  await cancelAllReminders();

  // 1. Nudge about the game that has been sitting in "playing" the longest.
  const stale = getAllGames()
    .filter((g) => g.status === 'playing')
    .map((g) => ({ game: g, idle: daysSince(g.last_played) }))
    .filter((entry): entry is { game: (typeof entry)['game']; idle: number } =>
      entry.idle !== null && entry.idle >= STALE_AFTER_DAYS
    )
    .sort((a, b) => b.idle - a.idle)[0];

  if (stale) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif_stale_title', lang),
        body: t('notif_stale_body', lang)
          .replace('{game}', stale.game.title)
          .replace('{days}', String(stale.idle)),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextReminderDate(1),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }

  // 2. Remind about unfinished challenges near the end of the month.
  const openChallenges = getCurrentMonthChallenges().filter((c) => c.status === 'active');
  if (openChallenges.length > 0) {
    const today = new Date();
    const reminderDay = new Date(today.getFullYear(), today.getMonth(), CHALLENGE_REMINDER_DAY, REMINDER_HOUR);
    if (reminderDay.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('notif_challenge_title', lang),
          body: t('notif_challenge_body', lang).replace('{count}', String(openChallenges.length)),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDay,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
    }
  }
}
