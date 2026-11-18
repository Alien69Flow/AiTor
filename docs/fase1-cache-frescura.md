# Fase 1: caché, frescura de datos y límites

Esta rama añade los cimientos que faltaban para un dashboard de datos en vivo.

## Estado

- [x] Helpers compartidos (`api/_shared/`)
- [x] Salud de datos (`/api/health`)
- [x] Sondeo adaptativo (`useSmartPoll`)
- [x] `api/gdelt.ts` cableado (caché 5 min, ETag, 60/min por IP)
- [x] `api/traffic.ts` cableado (caché 30 s; 8 sondeos ADS-B dejan de repetirse)
- [x] `api/bitnodes.ts` cableado (caché 15 min; cuota de Blockchair a salvo)
- [x] `api/github.ts` cableado (caché 60 s; la cuota de 60/hora da para navegar)
- [x] Typecheck real de `api/` (`tsconfig.api.json`)
- [x] Tests: caché negativa, tráfico y GitHub (15 en total)
- [x] `.env.example`
- [ ] `writeDataset` en los publicadores programados
- [ ] Rate limit `failClosed` en `mcp` y `telegram-webhook`
- [ ] Un hook con `useSmartPoll`

## Qué hay

| Fichero | Para qué |
|---|---|
| `api/_shared/redis.ts` | Caché Upstash (REST, sin SDK), coalescing, caché negativa y marcas `seed-meta:<clave>` |
| `api/_shared/redis.test.ts` | Fija `cachedFetchJson`: acierto cacheado, fallo cacheado, `negative` vs `miss` |
| `api/_shared/rate-limit.ts` | Límite por IP atómico (Lua), cabeceras IETF `RateLimit-*` y respaldo en memoria |
| `api/_shared/cors.ts` | Lista blanca de orígenes; deja de usar `*` donde el endpoint cuesta dinero |
| `api/_shared/http.ts` | `sendJson` con ETag/304 y tiers de caché (`realtime` 30 s … `daily`) |
| `api/health.ts` | Salud **de datos**: OK / STALE / EMPTY / ERROR por fuente |
| `src/hooks/useSmartPoll.ts` | Sondeo con jitter, backoff y pausa en pestaña oculta |
| `api/gdelt.ts` | Migrado: caché compartida, ETag y límite de 60/min |
| `api/traffic.ts` | Migrado: caché 30 s, ETag, 120/min. Marca de tiempo dentro del payload |
| `api/bitnodes.ts` | Migrado: caché 15 min, ETag, 60/min |
| `api/github.ts` | Migrado: caché 60 s, ETag, 60/min; sólo se cachean los 200 |
| `api/traffic.test.ts`, `api/github.test.ts` | Handlers reales con `fetch` falso: 200, ETag, 304, rechazos |
| `tsconfig.api.json` | Compila `api/` con `strict`. Antes ningún comando del repo miraba esos ficheros |
| `.env.example` | Las variables que la fase necesita |

## Por qué los imports acaban en `.js`

El repo es ESM (`"type": "module"`). En ESM, un import relativo sin extensión no
resuelve: Vercel devuelve `FUNCTION_INVOCATION_FAILED` (500). Es el fallo que
está documentado en `api/predictions.ts` y la razón por la que cada handler
duplicaba su propia caché y su propio CORS. No quites esas extensiones.

Al empaquetar, esbuild resuelve `./_shared/redis.js` → `redis.ts` (comprobado: el
bundle de `gdelt` incluye la caché, y el build de Vercel del commit `6a9f7ac`
terminó en verde con estos imports). En los tests, vitest resuelve `./traffic`
sin extensión.

## Variables de entorno

Ver `.env.example`. Resumen:

| Variable | Para qué |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Endpoint REST de Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token de Upstash |
| `REDIS_TIMEOUT_MS` | Opcional (1500) |
| `REDIS_PIPELINE_TIMEOUT_MS` | Opcional (4000) |
| `ALLOWED_ORIGINS` | Opcional: orígenes extra separados por coma |
| `OPERATOR_KEY` | Opcional: detalle de `/api/health` sin `?compact=1` |
| `GITHUB_TOKEN` | Opcional: 60 lecturas/hora → 5.000/hora |
| `GITHUB_REPO_ALLOWLIST` | Repos donde se permite usar el token |

Sin Redis, `cachedFetchJson` va siempre a la fuente y `/api/health` responde
`status: "UNCONFIGURED"` (sin `summary`, porque no hay nada que resumir).
Es degradación explícita, no un error. Efecto secundario: sin Redis el ETag de
`traffic` cambia en cada petición (la marca de tiempo es nueva), así que el 304
sólo aparece con la caché activa.

## Cómo comprobar que funciona

```bash
# 1. Tipos de la capa API (esto SÍ mira api/; tsconfig.app.json no la incluye)
npx tsc -p tsconfig.api.json --noEmit

# 2. Tipos del front (solo si tocaste el hook)
npx tsc -p tsconfig.app.json --noEmit

# 3. Caché y handlers
npx vitest run api/_shared/redis.test.ts api/traffic.test.ts api/github.test.ts

# 4. Build y arranque de funciones
npx vercel link          # solo la primera vez en tu copia
npx vercel build
npx vercel dev
```

`vercel dev` **no** sirve Vite: sirve los estáticos y ejecuta `api/**`. Para ver
la interfaz usa `npm run dev` (Vite, :5173) en otra terminal. Si la web sale
rota en :3000 no es un fallo de esta rama.

```bash
curl -i localhost:3000/api/health?compact=1                       # 200; UNCONFIGURED sin Upstash
curl -i localhost:3000/api/gdelt                                  # 200 + ETag
curl -i localhost:3000/api/traffic?kind=air                       # 200 + ETag + CDN s-maxage=30
curl -i localhost:3000/api/bitnodes                               # 200 + ETag + CDN s-maxage=1800
curl -i 'localhost:3000/api/github?action=tree'                   # 200 + ETag + CDN s-maxage=300
curl -i -H 'If-None-Match: "<etag>"' localhost:3000/api/gdelt    # 304
```

El `ETag` ya viene entre comillas: pégalo tal cual, sin añadir otras.

Nota: `gdelt`, `traffic`, `bitnodes` y `github` son de lectura pública
(`publicRead`), así que CORS responde `*` a propósito. El 403 por origen se
prueba en un endpoint autenticado.

## Caché negativa (bug corregido)

El primer commit escribía un centinela de `null` al fallar, pero `getJsonStatus`
lo traducía a `miss` y `cachedFetchJson` trata un `miss` como "sal a la red".
Con Redis configurado, una fuente caída recibía una petición por cada request
del cliente. Ahora `CacheRead` tiene el estado `negative` y `cachedFetchJson`
devuelve `null` sin llamar al `fetcher` mientras dure el TTL. El test lo fija:
con el código anterior, la segunda llamada invocaba el `fetcher` dos veces.

## Qué no se migra aquí, y por qué

- `api/league.ts`: la respuesta depende del usuario (JWT). Cachearla sería
  servirle a uno la clasificación de otro.
- `api/predictions.ts`: ya trae `s-maxage=60` y recorte por bytes; su cuerpo
  (hasta 4 MB) no cabe con holgura en Redis.

## Lo que falta para cerrar la fase

1. **Publicar datasets con frescura**: donde un script o cron escriba datos,
   llamar a `writeDataset(...)` y añadir la clave a `DATASETS` en
   `api/health.ts`. Solo claves que de verdad se publican.
2. **Rate limit fail-closed** en `api/telegram-webhook.ts` y `api/mcp.ts`.
   El segundo son 2.494 líneas: se hace con el fichero delante, no a ciegas.
3. **Un hook** con `useSmartPoll` y, si funciona, migrar el resto.

## Pendiente (siguientes fases, no hacer aquí)

- Consolidar las tres superficies MCP (`api/mcp.ts` 2.494 líneas,
  `backend/mcp.ts`, `src/lib/mcp/*`).
- Descubrimiento para agentes: `llms.txt`, `/.well-known/*`, `openapi.json`.
- CI: quitar `continue-on-error` de tests y lint.
- `backend/server.ts`: `app.use(cors())` acepta cualquier origen.
