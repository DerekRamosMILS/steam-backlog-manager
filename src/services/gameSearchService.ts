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
        igdbId: item.id,
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

// fetchGameMetadata is no longer used but exported for API compatibility.
// Steam Store Search doesn't provide individual game detail lookup by search ID.
export async function fetchGameMetadata(_id: number): Promise<ManualGameSearchResult | null> {
  return null;
}
