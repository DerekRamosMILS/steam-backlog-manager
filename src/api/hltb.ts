import { HLTBLookupStatus, HLTBResult } from '../types';

const HLTB_BASE_URL = 'https://howlongtobeat.com';
const HLTB_API_URL = `${HLTB_BASE_URL}/api/finder`;
const HLTB_INIT_URL = `${HLTB_BASE_URL}/api/finder/init`;
const HLTB_REFERER = `${HLTB_BASE_URL}/`;

interface HLTBGameEntry {
  game_id: number;
  game_name: string;
  comp_main: number;   // seconds
  comp_plus: number;   // seconds
  comp_100: number;    // seconds
}

interface HLTBApiResponse {
  data: HLTBGameEntry[];
  color: string;
  title: string;
  category: string;
  count: number;
  pageCurrent: number;
  pageTotal: number;
  pageSize: number;
}

interface HLTBTokenResponse {
  token: string;
}

const NOISE_TOKENS = [
  'demo',
  'playtest',
  'beta',
  'alpha',
  'soundtrack',
  'ost',
  'dlc',
  'edition',
  'bundle',
  'pack',
  'test server',
  'pts',
];

/**
 * Search HowLongToBeat for a game title.
 * Returns completion times in seconds (comp_main, comp_plus, comp_100).
 */
export async function searchHLTB(gameName: string): Promise<{
  status: HLTBLookupStatus;
  result: HLTBResult | null;
  errorMessage?: string;
}> {
  try {
    const variants = buildSearchVariants(gameName);

    for (const variant of variants) {
      const response = await runSearch(variant);
      if (response.status === 'request_failed') {
        return {
          status: 'request_failed',
          result: null,
          errorMessage: response.errorMessage,
        };
      }
      if (!response.data?.length) continue;

      const best = findBestMatch(gameName, response.data);
      if (!best) continue;

      return {
        status: 'success',
        result: {
          game_id: best.game_id,
          game_name: best.game_name,
          comp_main: best.comp_main,
          comp_plus: best.comp_plus,
          comp_100: best.comp_100,
        },
      };
    }

    return { status: 'not_found', result: null };
  } catch (error) {
    return {
      status: 'request_failed',
      result: null,
      errorMessage: error instanceof Error ? error.message : 'Unknown HLTB error',
    };
  }
}

function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\b(deluxe|definitive|ultimate|complete|remastered|reload|enhanced|gold|goty|game of the year)\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(query: string, entries: HLTBGameEntry[]): HLTBGameEntry | null {
  const q = normalise(query);
  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreMatch(q, normalise(entry.game_name)),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.45) {
    return null;
  }

  return best.entry;
}

async function runSearch(query: string): Promise<{
  status: HLTBLookupStatus;
  data?: HLTBGameEntry[];
  errorMessage?: string;
}> {
  const requestBody = {
    searchType: 'games',
    searchTerms: query.split(' ').filter(Boolean),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    // Force a fresh token if the previous attempt was rejected as unauthorized.
    const token = await getAuthToken(attempt > 1);
    if (!token) {
      return {
        status: 'request_failed',
        errorMessage: 'HLTB token request failed',
      };
    }

    const res = await fetch(HLTB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Referer: HLTB_REFERER,
        Origin: HLTB_BASE_URL,
        'x-auth-token': token,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36',
      },
      body: JSON.stringify(requestBody),
    });

    if (res.ok) {
      const responseBody = (await res.json()) as HLTBApiResponse;
      return {
        status: 'success',
        data: responseBody.data ?? [],
      };
    }

    // A cached token can go stale server-side; drop it and retry once with a fresh one.
    if ((res.status === 401 || res.status === 403) && attempt < 3) {
      invalidateAuthToken();
      continue;
    }

    // HLTB occasionally throws transient 5xx errors mid-batch.
    if (res.status >= 500 && attempt < 3) {
      await delay(attempt * 1500);
      continue;
    }

    return {
      status: 'request_failed',
      errorMessage: `HLTB POST ${HLTB_API_URL} failed with status ${res.status}`,
    };
  }

  return {
    status: 'request_failed',
    errorMessage: `HLTB POST ${HLTB_API_URL} failed after retries`,
  };
}

// One token serves every search. Re-requesting it per query (and per title variant)
// meant a 200-game batch fired thousands of /init calls and got throttled.
const TOKEN_TTL_MS = 10 * 60 * 1000;
let cachedToken: string | null = null;
let cachedTokenAt = 0;
let inFlightToken: Promise<string | null> | null = null;

function invalidateAuthToken(): void {
  cachedToken = null;
  cachedTokenAt = 0;
}

async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) invalidateAuthToken();

  if (cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  // Collapse the parallel batch into a single in-flight request.
  if (!inFlightToken) {
    inFlightToken = fetchAuthToken()
      .then((token) => {
        if (token) {
          cachedToken = token;
          cachedTokenAt = Date.now();
        }
        return token;
      })
      .finally(() => {
        inFlightToken = null;
      });
  }

  return inFlightToken;
}

async function fetchAuthToken(): Promise<string | null> {
  const url = `${HLTB_INIT_URL}?t=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Referer: HLTB_REFERER,
      Origin: HLTB_BASE_URL,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36',
    },
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as HLTBTokenResponse;
  return payload.token || null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchVariants(gameName: string): string[] {
  const cleaned = normalise(gameName);
  const variants = new Set<string>();
  const words = cleaned.split(' ').filter(Boolean);

  if (cleaned) variants.add(cleaned);

  const withoutNoise = words.filter(
    (word, index, arr) =>
      !NOISE_TOKENS.includes(word) &&
      !(word === 'test' && arr[index - 1] === 'server')
  );
  if (withoutNoise.length > 0) {
    variants.add(withoutNoise.join(' '));
  }

  const subtitleSplit = cleaned.split(/\s(?:edition|bundle|pack)\s/)[0];
  if (subtitleSplit) variants.add(subtitleSplit.trim());

  if (withoutNoise.length > 1) {
    variants.add(withoutNoise.slice(0, 2).join(' '));
    variants.add(withoutNoise.slice(0, 3).join(' '));
  }

  return Array.from(variants).filter((variant) => variant.length >= 2);
}

function scoreMatch(query: string, candidate: string): number {
  if (query === candidate) return 1;
  if (candidate.startsWith(query) || query.startsWith(candidate)) return 0.92;
  if (candidate.includes(query) || query.includes(candidate)) return 0.82;

  const queryTokens = query.split(' ').filter(Boolean);
  const candidateTokens = candidate.split(' ').filter(Boolean);
  const overlap = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  const tokenScore = overlap / Math.max(queryTokens.length, candidateTokens.length, 1);

  const queryJoined = queryTokens.join('');
  const candidateJoined = candidateTokens.join('');
  const prefixBonus =
    queryJoined.slice(0, 6) === candidateJoined.slice(0, 6) ? 0.12 : 0;

  return tokenScore + prefixBonus;
}
