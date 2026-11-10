# Firecrawl: migración a la API v2

La v1 se apaga el **jueves 10 de diciembre de 2026, 15:00 UTC**. Desde ese
momento `/v1/scrape`, `/v1/search`, `/v1/crawl`, `/v1/map` y `/v1/batch/scrape`
responden **410 Gone** y los feeds que dependen de ellos se quedan vacíos sin
decir por qué.

## Qué cambia de verdad

Un cambio de URL no basta. Lo que rompe en silencio:

| v1 | v2 |
| --- | --- |
| Resultados de `/search` en `data` (array) | `data.web` (`data.news`, `data.images` si se piden) |
| `limit` por defecto 5 | `limit` por defecto 10 |
| formato `"extract"` o `"json"` + `jsonOptions` | `{ "type": "json", "prompt", "schema" }` dentro de `formats`; se lee en `data.json` |
| `GET /crawl/ongoing` | `GET /crawl/active` |
| `geolocation` | `location` |
| `parsePDF: false` | `parsers: []` |

Que el array desaparezca es lo peligroso: el cliente no recibe un error, recibe
`undefined` y pinta una lista vacía. Por eso el normalizador
`webResults()` acepta **las dos** formas (`supabase/functions/_shared/firecrawl.ts`).

## Estado en este repositorio

Migradas a v2 con ese módulo común:

- `supabase/functions/firecrawl-search` — búsqueda web.
- `supabase/functions/crypto-feed` — acción `news`.
- `supabase/functions/ufo-feed` — scrape de NUFORC y búsqueda de noticias UAP.
- `supabase/functions/osint-aggregator` — ya llamaba a `/v2/search`, ahora usa el
  normalizador y deja de mandar `lang` (v2 no lo documenta).

No usan Firecrawl, aunque el nombre lo sugiera:

- `firecrawl-osint`: descarga el HTML de tres medios y extrae titulares.

### El SDK no está instalado, y no hace falta

`package.json` **no** incluye `@mendable/firecrawl-js`: las funciones llaman a la
REST API con `fetch`. No hay nada que actualizar de versión, y añadir el paquete
obligaría a regenerar `package-lock.json` (`npm ci` falla si no coinciden). Si
en el futuro se quiere usar el SDK, la versión es la última de
`@mendable/firecrawl-js` y su superficie cambia (`scrapeUrl` → `scrape`,
`mapUrl` → `map`, `crawlUrl` → `crawl`, los resultados de búsqueda en `.web` y
sin campo `success`).

## MCP

`api/mcp.ts` no expone ninguna herramienta de Firecrawl, así que no hay nada que
migrar ahí. Si se quiere añadir búsqueda web al agente, el servidor oficial ya
está en v2 y se arranca con:

```bash
npx -y firecrawl-mcp@latest
```

En la configuración del cliente MCP, `firecrawl-mcp` 1.x se sustituye por esa
misma orden (sin versión fija).

## n8n

n8n no vive en este repositorio: aparece sólo en el catálogo (`src/data/arsenal.json`)
y en `docs/arsenal.md`. La migración es en la instancia:

1. Actualizar el nodo de Firecrawl a su última versión.
2. En la credencial de Firecrawl, poner **Base URL** = `https://api.firecrawl.dev/v2`.
3. En los nodos *HTTP Request*, cambiar cualquier `/v1/` por `/v2/`.
4. Sustituir el nodo de comunidad `n8n-nodes-firecrawl` por el oficial
   `@mendable/n8n-nodes-firecrawl`.
5. Repasar las expresiones que lean `data` para buscar resultados de búsqueda:
   ahora están en `data.web`.

## Desplegar

El código de `supabase/functions/` **no está en producción** hasta que se
despliegue. Hasta entonces sigue corriendo la versión v1 y el 10 de diciembre
se apaga:

```bash
npm run edge:deploy
npm run edge:check        # firecrawl-search, crypto-feed, osint-aggregator
```

`ufo-feed` no lo llama el navegador: se comprueba con su cron y el secreto
`UFO_FEED_SECRET`.
