# Fase 1: caché, frescura de datos y límites

Esta rama añade los cimientos que faltaban para un dashboard de datos en vivo.

## Estado

- [x] Helpers compartidos (`api/_shared/`)
- [x] Salud de datos (`/api/health`)
- [x] Sondeo adaptativo (`useSmartPoll`)
- [x] Primer handler cableado: `api/gdelt.ts`
- [ ] Resto de handlers (`traffic`, `predictions`, `bitnodes`, `github`, `league`)
- [ ] `writeDataset` en los publicadores programados
- [ ] Rate limit `failClosed` en `mcp` y `telegram-webhook`

## Qué hay

| Fichero | Para qué |
|---|---|
| `api/_shared/redis.ts` | Caché Upstash (REST, sin SDK), coalescing de peticiones simultáneas, caché negativa y marcas `seed-meta:<clave>` |
| `api/_shared/rate-limit.ts` | Límite por IP atómico (Lua), cabeceras IETF `RateLimit-*` y respaldo en memoria si Redis cae |
| `api/_shared/cors.ts` | Lista blanca de orígenes; deja de usar `*` donde el endpoint cuesta dinero |
| `api/_shared/http.ts` | `sendJson` con ETag/304 y caché por niveles; `sendError` con forma estable |
| `api/health.ts` | Salud **de datos**: OK / STALE / EMPTY / ERROR por fuente |
| `src/hooks/useSmartPoll.ts` | Sondeo con jitter, backoff y pausa en pestaña oculta |
| `api/gdelt.ts` | Migrado: caché compartida, ETag y límite de 60/min |

## Por qué los imports acaban en `.js`

El repo es ESM (`"type": "module"`). En ESM, un import relativo sin extensión no
resuelve: Vercel devuelve `FUNCTION_INVOCATION_FAILED` (500). Es el fallo que
está documentado en `api/predictions.ts` y la razón por la que cada handler
duplicaba su propia caché y su propio CORS. No quites esas extensiones.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Endpoint REST de Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token de Upstash |
| `REDIS_TIMEOUT_MS` | Opcional (1500) |
| `REDIS_PIPELINE_TIMEOUT_MS` | Opcional (4000) |
| `ALLOWED_ORIGINS` | Opcional: orígenes extra separados por coma |
| `OPERATOR_KEY` | Opcional: detalle de `/api/health` sin `?compact=1` |

Sin Redis, `cachedFetchJson` va siempre a la fuente y `/api/health` responde
`status: "UNCONFIGURED"`. Es degradación explícita, no un error.

## Cómo comprobar que funciona

```bash
npx tsc -p tsconfig.app.json --noEmit
npx vercel build && npx vercel dev
```

```bash
curl -i localhost:3000/api/health?compact=1                       # 200 + status/summary
curl -i localhost:3000/api/gdelt                                  # 200 + ETag
curl -i -H 'If-None-Match: "<etag>"' localhost:3000/api/gdelt    # 304
curl -i -H 'Origin: https://ejemplo-malo.com' localhost:3000/api/gdelt  # sin bloqueo: es lectura pública
```

Nota: `/api/gdelt` es de lectura pública (`publicRead`), así que CORS responde
`*` a propósito. El 403 por origen se prueba en un endpoint autenticado.

## Lo que falta para cerrar la fase

1. **Cablear el resto de handlers** igual que `gdelt`: `traffic`, `predictions`,
   `bitnodes`, `github`, `league`. En cada uno, la clave de caché debe incluir
   **todos** los parámetros que cambian la respuesta.
2. **Publicar datasets con frescura**: donde un script o cron escriba datos,
   llamar a `writeDataset(...)` y añadir la clave a `DATASETS` en
   `api/health.ts`. Solo claves que de verdad se publican.
3. **Rate limit fail-closed** en `api/mcp.ts`, `api/telegram-webhook.ts` y
   cualquier endpoint que llame a Gemini/Firecrawl.
4. **Un hook** con `useSmartPoll` y, si funciona, migrar el resto.

## Pendiente (siguientes fases, no hacer aquí)

- Consolidar las tres superficies MCP (`api/mcp.ts` 2.494 líneas,
  `backend/mcp.ts`, `src/lib/mcp/*`).
- Descubrimiento para agentes: `llms.txt`, `/.well-known/*`, `openapi.json`.
- `tsconfig.api.json` para typechequear `api/` (hoy no se comprueba).
- CI: quitar `continue-on-error` de tests y lint.
- `backend/server.ts`: `app.use(cors())` acepta cualquier origen.
