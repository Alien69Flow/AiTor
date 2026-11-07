/**
 * Alias de compatibilidad del proxy de predicciones.
 *
 * El middleware de desarrollo (`vite.config.ts`) y `scripts/test-predictions.ts`
 * importan desde este módulo, pero la implementación vive en `predictions.ts`:
 * así la función serverless no tiene imports relativos —el despliegue de Vercel
 * respondía `FUNCTION_INVOCATION_FAILED` (500) con el import `./_venues`— y no
 * existen dos versiones del mismo selector de venues que puedan divergir.
 *
 * Este archivo no se publica como ruta: Vercel ignora los ficheros que empiezan
 * por guion bajo.
 */
export {
  GAMMA_MAX_MARKETS,
  GAMMA_READER_MAX_EVENTS,
  READER_PREFIX,
  READER_TIMEOUT_MS,
  RESPONSE_MAX_BYTES,
  VENUE_CACHE_SECONDS,
  VENUE_IDS,
  VENUE_MAX_LIMIT,
  VENUE_TIMEOUT_MS,
  compactGammaPayload,
  fetchVenue,
  trimToByteBudget,
  isSafeInterval,
  isSafeSlug,
  isSafeToken,
  isVenueId,
  parseReaderPayload,
  parseVenueBody,
  readerUrl,
  venueUrl,
} from "./predictions";

export type {
  Egress,
  PredictionInterval,
  VenueFetchDeps,
  VenueId,
  VenueRequest,
  VenueResult,
} from "./predictions";
