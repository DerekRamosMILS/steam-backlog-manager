import {
  fetchOwnedGames,
  fetchPublicProfile,
  parseSteamInput,
  resolveVanityUrl,
} from '../api/steam';
import { upsertGame } from '../database/queries';
import { SteamGame } from '../types';
import { steamCoverUrl } from '../utils/formatters';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Import (or refresh) the Steam library for the configured SteamID.
 * Upserts games into the local SQLite database.
 */
export async function importSteamLibrary(
  steamInput: string,
  apiKey: string,
  onProgress?: (imported: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // 1. Resolve Steam ID. The public profile XML resolves vanity names without a key,
  //    and tells us up front whether the profile is even readable.
  let steamId: string;
  try {
    const profile = await fetchPublicProfile(steamInput);
    if (!profile.isPublic) {
      result.errors.push(
        'This Steam profile is private. Set it to Public in your Steam privacy settings, then try again.'
      );
      return result;
    }
    steamId = profile.steamId64;
  } catch (publicErr: unknown) {
    // Fall back to the keyed endpoint; it can resolve profiles the community page won't serve.
    const parsed = parseSteamInput(steamInput);
    if (parsed.type === 'id') {
      steamId = parsed.value;
    } else if (apiKey?.trim()) {
      try {
        steamId = await resolveVanityUrl(parsed.value, apiKey);
      } catch (err: unknown) {
        result.errors.push(err instanceof Error ? err.message : 'Failed to resolve Steam ID.');
        return result;
      }
    } else {
      result.errors.push(
        publicErr instanceof Error ? publicErr.message : 'Failed to resolve Steam ID.'
      );
      return result;
    }
  }

  if (!apiKey?.trim()) {
    result.errors.push(
      'A Steam Web API key is required to read your games list. Steam no longer serves libraries publicly.'
    );
    return result;
  }

  // 2. Fetch games list
  let games: SteamGame[];
  try {
    games = await fetchOwnedGames(steamId, apiKey);
  } catch (err: unknown) {
    result.errors.push(
      err instanceof Error ? err.message : 'Failed to fetch games from Steam API.'
    );
    return result;
  }

  return importGames(games, result, onProgress);
}

function importGames(
  games: SteamGame[],
  result: ImportResult,
  onProgress?: (imported: number, total: number) => void
): ImportResult {

  // 3. Upsert each game into the database
  const total = games.length;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    try {
      const lastPlayed = g.rtime_last_played
        ? new Date(g.rtime_last_played * 1000).toISOString()
        : null;

      upsertGame(
        g.appid,
        g.name,
        steamCoverUrl(g.appid),
        g.playtime_forever,
        lastPlayed
      );
      result.imported++;
    } catch {
      result.skipped++;
    }
    onProgress?.(i + 1, total);
  }

  return result;
}
