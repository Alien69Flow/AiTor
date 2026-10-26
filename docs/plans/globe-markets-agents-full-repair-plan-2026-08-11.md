# Globe, Markets & Agents — full repair plan

Telegram is already fixed in this turn (the webhook was rejecting every Telegram
update because of a secret-token check added during the security pass; it now
only rejects when Telegram actually sends a wrong token).

The rest is big, so here is how I propose to do it.

## 1. Globe HUD (single tension indicator)

- Remove the left-hand tension widget and keep one merged indicator in the
  centre of the globe.
- Feed it real numbers: earthquakes (USGS), conflict/OSINT events, space weather
  Kp, wildfires and outages — weighted score, live-updating, with a breakdown on
  hover.
- "Legend & Controls" panel collapsed by default on every device.

## 2. Layers that must actually render

Right now several toggles exist but draw nothing. Each of these gets a real data
source and a visible layer on the Cesium globe:

| Layer | Source |
|---|---|
| Clouds, Rain/Precipitation, Temperature, Wind, Pressure (isobars) | OpenWeatherMap tiles via the existing `openweather` proxy — fix the tile URL/alpha so they show without a toggle-off/on |
| Rain radar | RainViewer frames |
| Wildfires (incl. Spain/Europe) | NASA FIRMS VIIRS global (current feed is truncated) + Copernicus EFFIS for Europe |
| Solar activity / aurora | NOAA SWPC Kp + ovation |
| Orbital surveillance | Satellite TLE propagation (CelesTrak) |
| Air traffic | OpenSky, global tiles instead of one bbox |
| Marine traffic | AIS feed, global bbox |
| Internet outages | Cloudflare Radar / IODA |
| Ocean currents | NOAA OSCAR / RTOFS surface currents |

Each layer gets a small "no data / source down" state so a dead upstream is
visible instead of an invisible layer.

## 3. Conflict layer (WorldMonitor / Liveuamap / ConflictRadar360 style)

- Ingest events from the WorldMonitor shared data already vendored in the repo
  plus the live OSINT aggregator.
- Each event is a map icon with a category emoji (💥 strike, 🚀 missile, 🛩️ air,
  🚢 naval, 🔥 fire, ⚡ infrastructure, 🕊️ diplomacy …), plus a popup card with
  time, location, source, reliability score, short summary and image when the
  source provides one.
- Filterable by category and reliability.

## 4. Markets & Polymarket done properly

- Restore the assets/markets surface: crypto, stocks, ETFs, commodities, FX
  (the JSON universes already vendored under `worldmonitor/shared`).
- Polymarket via its Gamma API: full multi-outcome markets, not just yes/no —
  each outcome with its own price, 24h change, volume and liquidity, plus a
  sparkline. Affiliate link kept.

## 5. Agents + DeepSeek

- Register every agent that exists in `backend/agents` as a callable tool in the
  `agenticworkflows` router (Manus, Accio, market analyzer, portfolio manager,
  trading signals, security, social media, supervisor/orchestrator).
- Add DeepSeek as a selectable oracle in the chat model list and route it in the
  `chat` edge function using the `DEEPSEEK_API_KEY` already stored.

## Order of work

1. Globe HUD merge + legend collapsed + clouds/OWM tile fix (fast, visible).
2. Remaining layers, one by one, with a data-source status line.
3. Conflict icon layer.
4. Markets + Polymarket multi-outcome.
5. Agents routing + DeepSeek.

## Notes / what I need from you

- If you have the WorldMonitor fork URL and the other reference repos you
  mentioned, drop the links — I will pull the exact conflict taxonomy and icon
  set from them instead of inventing one.
- Copernicus/EFFIS, Meteosat and Hispasat: EFFIS has an open WMS I can use
  directly. Meteosat/Hispasat imagery needs an EUMETSAT account/API key — tell
  me if you want that and I will request the credential.
