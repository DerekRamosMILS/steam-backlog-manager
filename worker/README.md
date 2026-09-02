# backlogflow-steam

A stateless Cloudflare Worker that imports a Steam library on the app's behalf.

## Why

Steam's `GetOwnedGames` requires a Web API key, and Steam closed the public
profile games list — `/games?tab=all&xml=1` now redirects to a login page.
Without this proxy, every user has to generate and paste their own developer
key, which is where most of them abandon onboarding.

## What it does not do

It stores nothing. No database, no accounts, no request logs tying a person to
a library. Your Steam key lives as a Worker secret and never reaches the app.
That keeps the app's privacy declaration simple: still no personal data
collected.

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put STEAM_API_KEY   # paste your own key when prompted
npx wrangler deploy
```

`wrangler secret put` prompts for the value and sends it straight to
Cloudflare — do not put the key in `wrangler.toml`, and do not commit it.

## Endpoints

| Route | Result |
|---|---|
| `GET /health` | `{"ok":true}` |
| `GET /library?steamid=<id \| vanity \| profile URL>` | normalized game list |

Success:

```json
{
  "steamId": "76561197960435530",
  "count": 214,
  "games": [
    {
      "appid": 367520,
      "name": "Hollow Knight",
      "playtimeMinutes": 1893,
      "lastPlayed": "2026-07-27T00:00:00.000Z",
      "coverUrl": "https://steamcdn-a.akamaihd.net/steam/apps/367520/header.jpg"
    }
  ]
}
```

Errors return `{"error":{"code","message"}}`:
`missing_steamid` (400), `invalid_steamid` (400), `profile_not_found` (404),
`library_private` (403), `not_configured` (500).

Responses are cached at the edge for 10 minutes per SteamID.

## Wiring the app to it

`importSteamLibrary` in `src/services/steamService.ts` currently requires the
user's own key. To use the proxy, point it at `GET /library` and drop the key
requirement — the fallback to a user-supplied key is worth keeping for people
who prefer not to route through the proxy.

## Not done yet

HowLongToBeat is still scraped directly from each device with a forged
User-Agent. Moving that here would make it far more robust: one place to fix
when HLTB changes, and edge caching instead of every user hammering them.
