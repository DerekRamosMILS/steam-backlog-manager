/**
 * gameSearchService.ts
 *
 * Game search using the Steam Store public search API.
 * No authentication required — works fully offline-first.
 *
 * Endpoint: https://store.steampowered.com/api/storesearch/
 * Cover images: https://steamcdn-a.akamaihd.net/steam/apps/{appid}/header.jpg
 */

import { ManualGameSearchResult } from '../types';

const STEAM_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/';
const STEAM_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const STEAM_HEADER_URL = (appid: number) =>
  `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;

interface SteamSearchItem {
  type: string;
  name: string;
  id: number;
  tiny_image?: string;
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  metascore?: string;
  streamingvideo?: boolean;
  controller_support?: string;
  price?: unknown;
}

interface SteamSearchResponse {
  total: number;
  items: SteamSearchItem[];
}

interface SteamDetailsData {
  name: string;
  header_image?: string;
  short_description?: string;
  developers?: string[];
  platforms?: SteamSearchItem['platforms'];
  release_date?: { coming_soon: boolean; date: string };
}

type SteamDetailsResponse = Record<string, { success: boolean; data?: SteamDetailsData }>;

function mapPlatforms(p?: SteamSearchItem['platforms']): string[] {
  if (!p) return [];
  const names: string[] = [];
  if (p.windows) names.push('Windows');
  if (p.mac) names.push('Mac');
  if (p.linux) names.push('Linux');
  return names;
}

export async function searchGamesByTitle(query: string): Promise<ManualGameSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const url = `${STEAM_SEARCH_URL}?term=${encodeURIComponent(query.trim())}&l=english&cc=US`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BacklogFlow-Mobile-App',
      },
    });

    if (!response.ok) {
      console.warn('[gameSearchService] Steam search error:', response.status);
      return [];
    }

    const data: SteamSearchResponse = await response.json();

    if (!Array.isArray(data.items)) return [];

    return data.items
      .filter((item) => item.type === 'app')
      .slice(0, 10)
      .map((item): ManualGameSearchResult => ({
        appId: item.id,
        title: item.name,
        coverUrl: STEAM_HEADER_URL(item.id),
        releaseYear: null,
        summary: null,
        platforms: mapPlatforms(item.platforms),
        developer: null,
      }));
  } catch (e) {
    console.warn('[gameSearchService] Network error:', e);
    return [];
  }
}

/**
 * Fetch full details for a single Steam appid.
 * storesearch/ omits release year, summary and developer — appdetails has them.
 */
export async function fetchGameMetadata(appId: number): Promise<ManualGameSearchResult | null> {
  try {
    const url = `${STEAM_DETAILS_URL}?appids=${appId}&l=english&cc=US`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'BacklogFlow-Mobile-App' },
    });

    if (!response.ok) {
      console.warn('[gameSearchService] Steam appdetails error:', response.status);
      return null;
    }

    const payload: SteamDetailsResponse = await response.json();
    const entry = payload?.[String(appId)];
    if (!entry?.success || !entry.data) return null;

    const d = entry.data;
    const year = d.release_date?.date
      ? Number(d.release_date.date.match(/\d{4}/)?.[0]) || null
      : null;

    return {
      appId,
      title: d.name,
      coverUrl: d.header_image ?? STEAM_HEADER_URL(appId),
      releaseYear: year,
      summary: d.short_description ? stripHtml(d.short_description) : null,
      platforms: mapPlatforms(d.platforms),
      developer: d.developers?.[0] ?? null,
    };
  } catch (e) {
    console.warn('[gameSearchService] appdetails network error:', e);
    return null;
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
