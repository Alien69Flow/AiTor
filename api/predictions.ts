/**
 * `GET /api/predictions?venue=kalshi|limitless&limit=25`
 *
 * El navegador no puede consultar estos venues directamente: Kalshi devuelve
 * 403 cuando la petición lleva cabecera `Origin` y Limitless no envía
 * `Access-Control-Allow-Origin`. Esta función hace de puente en el mismo origen
 * (Vercel), con la lista de venues en whitelist y límite acotado —no es un
 * proxy abierto—. El mapeo a `PredictionEvent` sigue siendo cliente; aquí solo
 * se reenvía el JSON crudo del venue.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchVenue, isVenueId, VENUE_CACHE_SECONDS } from "./_venues";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const venue = typeof req.query.venue === "string" ? req.query.venue : null;
  if (!isVenueId(venue)) {
    res.status(400).json({ error: "unknown venue; use kalshi or limitless" });
    return;
  }

  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 25;

  try {
    const result = await fetchVenue(venue, limit);
    // Caché en el CDN para no martillear al venue con cada visita.
    res.setHeader("Cache-Control", `public, s-maxage=${VENUE_CACHE_SECONDS}, stale-while-revalidate=${VENUE_CACHE_SECONDS * 5}`);
    if (!result.ok) {
      res.status(502).json({ error: `${venue} respondió HTTP ${result.status}` });
      return;
    }
    res.status(200).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    res.status(502).json({ error: `${venue} inaccesible: ${message}` });
  }
}
