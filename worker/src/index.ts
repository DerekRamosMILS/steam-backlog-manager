/**
 * backlogflow-steam — a stateless proxy for Steam library imports.
 *
 * Why it exists: Steam's GetOwnedGames requires a Web API key, and Steam closed
 * the public profile games list (it redirects to a login page). Without this
 * proxy every user has to generate and paste their own developer key, which is
 * where most of them give up.
 *
 * What it deliberately does NOT do: store anything. No database, no accounts,
 * no logs of who asked for what. A request goes in, Steam is queried with the
 * operator's key, a normalized list comes back. That keeps the app's privacy
 * story intact — nothing personal is retained anywhere.
 */

export interface Env {
  STEAM_API_KEY: string;
  /** Optional comma-separated allowlist of app identifiers. Unset = open. */
  ALLOWED_CLIENTS?: string;
}

const STEAM_API = 'https://api.steampowered.com';
const CACHE_SECONDS = 600;

interface SteamOwnedGame {
  appid: number;
  name?: string;
  playtime_forever?: number;
  rtime_last_played?: number;
}

interface NormalizedGame {
  appid: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: string | null;
  coverUrl: string;
}

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });
}

function fail(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

/** Accepts a 17-digit id, a /profiles/<id> URL, a /id/<vanity> URL, or a bare vanity. */
export function parseSteamInput(raw: string): { type: 'id' | 'vanity'; value: string } {
  const input = raw.trim();
  if (/^\d{17}$/.test(input)) return { type: 'id', value: input };

  const byProfile = input.match(/\/profiles\/(\d{17})/);
  if (byProfile) return { type: 'id', value: byProfile[1] };

  const byVanity = input.match(/\/id\/([a-zA-Z0-9_-]+)/);
  if (byVanity) return { type: 'vanity', value: byVanity[1] };

  return { type: 'vanity', value: input };
}

async function resolveVanity(vanity: string, key: string): Promise<string | null> {
  const url = `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { response?: { success?: number; steamid?: string } };
  return data.response?.success === 1 ? (data.response.steamid ?? null) : null;
}

async function fetchLibrary(steamId: string, key: string): Promise<SteamOwnedGame[] | null> {
  const url =
    `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { response?: { games?: SteamOwnedGame[] } };
  // Steam answers 200 with an empty object when the profile hides game details.
  return data.response?.games ?? null;
}

function normalize(games: SteamOwnedGame[]): NormalizedGame[] {
  return games
    .filter((g) => Number.isFinite(g.appid) && g.appid > 0)
    .map((g) => ({
      appid: g.appid,
      name: g.name ?? `App ${g.appid}`,
      playtimeMinutes: g.playtime_forever ?? 0,
      lastPlayed: g.rtime_last_played
        ? new Date(g.rtime_last_played * 1000).toISOString()
        : null,
      coverUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${g.appid}/header.jpg`,
    }));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return fail(405, 'method_not_allowed', 'Use GET.');
    }
    if (url.pathname === '/health') {
      return json({ ok: true });
    }
    if (url.pathname !== '/library') {
      return fail(404, 'not_found', 'Unknown endpoint.');
    }
    if (!env.STEAM_API_KEY) {
      return fail(500, 'not_configured', 'The proxy has no Steam API key configured.');
    }

    const steamInput = url.searchParams.get('steamid')?.trim();
    if (!steamInput) {
      return fail(400, 'missing_steamid', 'Pass ?steamid= with an ID, profile URL or vanity name.');
    }
    if (steamInput.length > 128) {
      return fail(400, 'invalid_steamid', 'That does not look like a Steam ID.');
    }

    // Serve a recent identical lookup without touching Steam again.
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/library?steamid=${encodeURIComponent(steamInput)}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const parsed = parseSteamInput(steamInput);
    let steamId = parsed.value;
    if (parsed.type === 'vanity') {
      const resolved = await resolveVanity(parsed.value, env.STEAM_API_KEY);
      if (!resolved) {
        return fail(404, 'profile_not_found', 'No Steam profile matches that name.');
      }
      steamId = resolved;
    }

    const games = await fetchLibrary(steamId, env.STEAM_API_KEY);
    if (games === null) {
      return fail(
        403,
        'library_private',
        'Steam returned no games. Set "Game details" to Public in your Steam privacy settings.'
      );
    }

    const response = json({ steamId, count: games.length, games: normalize(games) }, 200, CACHE_SECONDS);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler<Env>;
