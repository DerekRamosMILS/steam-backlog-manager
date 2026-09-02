export type GameStatus =
  | 'playing'
  | 'up_next'
  | 'paused'
  | 'completed'
  | 'abandoned'
  | 'not_started';

export type GamePriority = 'high' | 'medium' | 'low';

export type Platform = 'steam' | 'gog' | 'epic' | 'playstation' | 'xbox' | 'nintendo' | 'emulator' | 'other';

export type ImportPlatform = 'steam' | 'gog' | 'epic';

export interface Game {
  id: number;
  steam_app_id: number;
  external_id?: string | null;
  id_source?: string | null;
  title: string;
  cover_url: string;
  status: GameStatus;
  priority: GamePriority;
  platform: Platform;
  playtime_minutes: number;
  hltb_main_story: number | null;
  hltb_completionist: number | null;
  hltb_extra: number | null;
  last_played: string | null;
  added_at: string;
  notes: string;
  progress_percentage: number;
  sort_order: number;
  exclude_from_backlog: number;
  price_cents?: number | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  summary?: string | null;
  release_year?: number | null;
  genre_names?: string | null;
  developer_name?: string | null;
  publisher_name?: string | null;
  metadata_source?: string | null;
  metadata_cached_at?: string | null;
  cover_local_path?: string | null;
  is_manual_entry?: number;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rtime_last_played: number;
}

export interface SteamApiResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}

export interface HLTBResult {
  game_id: number;
  game_name: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
}

export type HLTBLookupStatus = 'success' | 'not_found' | 'request_failed';

export interface BacklogStats {
  total: number;
  playing: number;
  up_next: number;
  paused: number;
  completed: number;
  abandoned: number;
  not_started: number;
  total_hours_remaining: number;
  total_playtime_hours: number;
  excluded_from_backlog: number;
  hltb_target_met: number;
  hltb_ready_to_finish: number;
}

export interface Recommendation {
  game: Game;
  reason: string;
  score: number;
  match: number;
  highlights: string[];
  whyNot?: string;
  badges: string[];
  confidence: 'low' | 'medium' | 'high';
  sessionsToFinish: number | null;
  daysWaiting: number;
}

export type RecommendationMood = 'balanced' | 'advance' | 'short' | 'chill' | 'resume' | 'finish';

export type RecommendationGoal = 'none' | 'finish_today' | 'two_sessions' | 'bite_size';

export interface TasteProfile {
  title: string;
  summary: string;
  tags: string[];
}

export interface BacklogMission {
  id: string;
  title: string;
  description: string;
  gameId?: number;
}

export interface SmartCollection {
  id: string;
  title: string;
  description: string;
  games: Recommendation[];
}

export interface WeeklyPlanItem {
  label: string;
  note: string;
  recommendation: Recommendation;
}

export interface WeeklyPlan {
  title: string;
  summary: string;
  totalHours: number;
  items: WeeklyPlanItem[];
}

export interface VersusPair {
  prompt: string;
  left: Recommendation;
  right: Recommendation;
}

export interface DailyPick {
  recommendation: Recommendation;
  streak: number;
  subtitle: string;
}

export interface CompletionCelebration {
  gameId: number;
  title: string;
  savedHours: number;
  completedCount: number;
  dateKey: string;
}

export interface GamingSession {
  id: number;
  game_id: number;
  duration_minutes: number;
  session_date: string;
  notes: string;
}

export interface BacklogChallenge {
  id: number;
  type: string;
  target: number;
  progress: number;
  status: 'active' | 'completed' | 'failed';
  month_year: string;
}

export type Theme = 'cyberpunk' | 'neon' | 'oled' | 'retro' | 'ps_blue' | 'dark' | 'light';

export interface AppSettings {
  steam_id: string;
  steam_api_key: string;
  show_nsfw: boolean;
  default_sort: string;
  theme: Theme;
  currency: 'usd' | 'mxn';
}

export interface StatusConfig {
  label: string;
  color: string;
  icon: string;
}

export interface PriorityConfig {
  label: string;
  color: string;
  icon: string;
}

export const STATUS_CONFIG: Record<GameStatus, StatusConfig> = {
  playing: { label: 'Playing', color: '#4ade80', icon: 'play-circle' },
  up_next: { label: 'Up Next', color: '#60a5fa', icon: 'bookmark' },
  paused: { label: 'Paused', color: '#facc15', icon: 'pause-circle' },
  completed: { label: 'Completed', color: '#a78bfa', icon: 'checkmark-circle' },
  abandoned: { label: 'Abandoned', color: '#f87171', icon: 'close-circle' },
  not_started: { label: 'Not Started', color: '#9ca3af', icon: 'ellipse-outline' },
};

export const PRIORITY_CONFIG: Record<GamePriority, PriorityConfig> = {
  high: { label: 'High', color: '#f43f5e', icon: 'arrow-up' },
  medium: { label: 'Medium', color: '#f97316', icon: 'remove' },
  low: { label: 'Low', color: '#6b7280', icon: 'arrow-down' },
};

// ─── Platform Config ──────────────────────────────────────────────────────────

export interface PlatformConfig {
  label: string;
  icon: string;
  color: string;
}

export const PLATFORM_CONFIG: Record<ImportPlatform, PlatformConfig> = {
  steam: { label: 'Steam', icon: 'logo-steam', color: '#1b2838' },
  gog: { label: 'GOG', icon: 'planet-outline', color: '#86328a' },
  epic: { label: 'Epic Games', icon: 'game-controller', color: '#0078f2' },
};

// ─── Multi-Platform Connection ────────────────────────────────────────────────

export interface PlatformConnection {
  platform: ImportPlatform;
  connected: boolean;
  lastSynced: string | null;
  displayName?: string;
  gameCount?: number;
}

// ─── Manual Game Types ────────────────────────────────────────────────────────

export interface ManualGameDraft {
  title: string;
  platform: Platform;
  status: GameStatus;
  priority: GamePriority;
  notes: string;
  coverUrl: string;
  releaseYear: number | null;
  summary: string | null;
  genreNames: string | null;
  developerName: string | null;
  publisherName: string | null;
  externalId: string | null;
  idSource: 'manual' | 'steam';
}

export interface ManualGameSearchResult {
  appId: number;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  summary: string | null;
  platforms: string[];
  developer: string | null;
}
