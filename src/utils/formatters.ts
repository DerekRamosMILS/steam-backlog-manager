import { GameStatus, GamePriority } from '../types';
import { t, Language } from '../i18n';

/**
 * Convert minutes to a human-readable hours string.
 * e.g. 125 -> "2h 5m"
 */
export function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Convert HLTB seconds to "Xh" display string.
 * HLTB returns values in seconds.
 */
export function formatHLTBTime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.round(seconds / 3600);
  if (hours < 1) return '< 1h';
  return `${hours}h`;
}

export function getRemainingMinutes(
  hltbSeconds: number | null,
  playtimeMinutes: number
): number | null {
  if (!hltbSeconds || hltbSeconds <= 0) return null;
  const totalMinutes = Math.round(hltbSeconds / 60);
  return Math.max(0, totalMinutes - Math.max(0, playtimeMinutes));
}

export function formatRemainingTime(
  hltbSeconds: number | null,
  playtimeMinutes: number
): string {
  const remainingMinutes = getRemainingMinutes(hltbSeconds, playtimeMinutes);
  if (remainingMinutes === null) return '—';
  return formatMinutes(remainingMinutes);
}

/**
 * Format a total hours number as a backlog estimate.
 * e.g. 523.5 -> "523 hours"
 */
export function formatBacklogHours(hours: number): string {
  if (hours < 1) return 'Under an hour';
  if (hours < 100) return `${Math.round(hours)} hours`;
  return `${Math.round(hours).toLocaleString()} hours`;
}

/**
 * Take a Unix timestamp and return "X days ago" / "Today" / ISO date.
 */
export function formatLastPlayed(
  unixTs: number | null | undefined,
  lang: Language = 'en'
): string {
  if (!unixTs) return t('fmt_never_played', lang);
  const now = Date.now();
  const diff = now - unixTs * 1000;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t('fmt_today', lang);
  if (days === 1) return t('fmt_yesterday', lang);
  if (days < 30) return `${days}${t('fmt_days_ago', lang)}`;
  if (days < 365) return `${Math.floor(days / 30)}${t('fmt_months_ago', lang)}`;
  return `${Math.floor(days / 365)}${t('fmt_years_ago', lang)}`;
}

/**
 * Truncate a string to a max length.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

/**
 * Build a Steam game header image URL.
 */
export function steamCoverUrl(appId: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
}

/**
 * Build a GOG cover image URL from the image slug returned by the API.
 */
export function gogCoverUrl(imageSlug: string): string {
  if (!imageSlug) return '';
  const slug = imageSlug.replace(/^\/\//, 'https://');
  return slug.startsWith('http') ? `${slug}_392.jpg` : `https:${slug}_392.jpg`;
}

/**
 * Extract the best cover image from Epic's keyImages array.
 */
export function epicCoverUrl(keyImages: Array<{ type: string; url: string }>): string {
  const preferred = ['DieselStoreFrontWide', 'OfferImageWide', 'DieselGameBoxTall', 'Thumbnail'];
  for (const type of preferred) {
    const img = keyImages.find((ki) => ki.type === type);
    if (img?.url) return img.url;
  }
  return keyImages[0]?.url ?? '';
}

/**
 * Calculate a rough progress emoji.
 */
export function progressEmoji(pct: number): string {
  if (pct >= 100) return '✅';
  if (pct >= 75) return '🔥';
  if (pct >= 50) return '⚡';
  if (pct >= 25) return '🕹️';
  return '📦';
}

/**
 * Sort games by priority weight.
 */
export function priorityWeight(p: GamePriority): number {
  return p === 'high' ? 3 : p === 'medium' ? 2 : 1;
}

/**
 * Status display label.
 */
export function statusLabel(status: GameStatus): string {
  const map: Record<GameStatus, string> = {
    playing: 'Playing',
    up_next: 'Up Next',
    paused: 'Paused',
    completed: 'Completed',
    abandoned: 'Abandoned',
    not_started: 'Not Started',
  };
  return map[status] ?? status;
}
