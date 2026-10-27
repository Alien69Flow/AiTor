# Edge Functions: despliegue y verificación

El proyecto tiene **20 Edge Functions** en `supabase/functions/` (más `_shared/`, que
no se despliega). Este documento es el procedimiento para subirlas y, sobre todo,
para comprobar que **responden de verdad** — que no es lo mismo que "están
desplegadas".

## Verificar (no requiere credenciales de administración)

```bash
npm run edge:check            # tabla de las 20 funciones
npm run edge:check -- --strict   # falla también con avisos (datos simulados)
```

El script (`scripts/check-edge-functions.mjs`) usa la URL y la clave publishable
del proyecto y lanza a cada función **la petición que hace el cliente real**: el
mismo método, query y body que usan los hooks. Distingue tres resultados:

| Icono | Significado |
| --- | --- |
| ✅ | 200 y el cuerpo tiene la forma que la UI consume |
| 🔒 | 401/403 del propio control de acceso de la función (sesión, secreto, allowlist de origen) — está funcionando |
| ❌ | 404 (nunca desplegada), 5xx, o un 200 cuyo cuerpo el cliente no puede usar |

También compara las carpetas de `supabase/functions/` con `supabase/config.toml`
y falla si falta alguna declaración (ver "Deriva de configuración").

### Estado medido el 2026-10-20

`14 responden · 5 protegidas correctamente · 2 avisos · 0 fallos`

Medido antes de retirar `mcp` y de añadir la sonda `chat?health=1`, que falla hasta
que se despliegue la versión nueva de `chat`.

Los dos avisos son `air-traffic` y `marine-traffic`: su upstream no respondía y
ambas devolvían **datos simulados** (`icao24: "mock0000"`,
`mmsi: "mock000000000"`). Eso ya no existe — se retiró el generador de tráfico
inventado —, así que a partir del despliegue el aviso significa "sin cobertura":
la función declara `unavailable: true` y sirve una capa vacía. Ver "Tráfico aéreo
y marítimo".

## Salud del chat: qué proveedores tienen clave

`chat` publica su propio informe, sin depender del panel:

```bash
curl -s "$SUPABASE_URL/functions/v1/chat?health=1" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" | jq
# GET a secas, ?health=1 y /chat/health responden lo mismo
# POST { "action": "health" } también, para clientes que solo pueden POSTear
```

```jsonc
{
  "service": "chat",
  "status": "degraded",            // ok | degraded | down
  "checkedAt": "2026-10-20T10:00:00.000Z",
  "providers": [
    { "id": "lovable", "envVar": "LOVABLE_API_KEY", "keyState": "missing",
      "configured": false, "where": "Supabase → Edge Functions → Secrets → LOVABLE_API_KEY" }
  ],
  "models": [
    { "id": "google/gemini-2.5-flash", "provider": "lovable", "available": false, "reason": "missing-key" }
  ],
  "defaultModel": "google/gemini-2.5-flash"
}
```

Tres decisiones que conviene conocer:

- **Nunca devuelve el secreto**, solo `keyState`: `ok`, `missing` o
  `placeholder` (el valor existe pero es `changeme`, `your-key…`, demasiado
  corto, o el nombre de la variable en vez del valor). Así un secreto mal pegado
  se distingue de uno ausente sin exponer nada.
- **`status`** es `ok` cuando responde el proveedor por defecto (Lovable),
  `degraded` cuando solo responden proveedores externos y `down` cuando no hay
  ninguna clave: en ese último caso el chat devuelve 500 y `edge:check` falla.
- **Es presencia de clave, no una llamada de pago**: una clave válida sin saldo
  sigue apareciendo como configurada; eso lo dice el error de la petición real
  (402) y el respaldo automático al gateway.

La UI consume ese informe (`src/lib/ai-health.ts`) y **desactiva** los oráculos
sin credencial en el selector en vez de esconderlos: cada fila bloqueada explica
`falta LOVABLE_API_KEY` o `clave inválida`, y el pie del selector muestra qué
proveedores tienen clave. Si el informe no se puede leer, no se desactiva nada
(se marca "claves sin verificar") y el envío sigue funcionando como antes.

El registro de proveedores vive en
`supabase/functions/_shared/ai-providers.ts`: es la única lista de qué variable
abre cada proveedor y qué modelos sirve, y de ahí salen tanto el enrutado de
`chat` como este informe.

## Desplegar

Requiere el CLI de Supabase y un token de acceso de la cuenta propietaria. Sin
`SUPABASE_ACCESS_TOKEN` (o un `supabase login` interactivo) el despliegue no se
puede hacer; el código de las funciones no es suficiente.

```bash
# 1. CLI (no está en package.json a propósito: es una herramienta global)
npx supabase --version || npm i -D supabase

# 2. Autenticarse (una vez por máquina)
npx supabase login                       # interactivo, abre el navegador
export SUPABASE_ACCESS_TOKEN=...         # o el token en CI

# 3. Enlazar el proyecto
npx supabase link --project-ref wkdtvrxavkhbifjtvvdw

# 4. Desplegar
npm run edge:deploy                      # = supabase functions deploy --project-ref ...

# 5. Verificar
npm run edge:check
```

`npm run edge:deploy` despliega todas las funciones con los valores de
`verify_jwt` de `supabase/config.toml`. Para iterar sobre una sola:

```bash
npx supabase functions deploy chat --project-ref wkdtvrxavkhbifjtvvdw
```

### Secretos

Los valores no viven en el repositorio. Se cargan en el proyecto una vez:

```bash
npx supabase secrets set --project-ref wkdtvrxavkhbifjtvvdw \
  FIRECRAWL_API_KEY=... OPENWEATHER_API_KEY=... OPENSKY_CLIENT_ID=... OPENSKY_CLIENT_SECRET=...
```

| Secreto | Funciones que lo usan | Sin él |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `ufo-feed`, `verify-crypto-payment`, `verify-dao-holdings`, `wallet-auth` | 500 al crear el cliente admin |
| `SUPABASE_ANON_KEY` | `github-proxy` | 500 al validar la sesión |
| `FIRECRAWL_API_KEY` | `firecrawl-search`, `firecrawl-osint`, `crypto-feed` (action `news`), `osint-aggregator`, `ufo-feed` | 500 "Firecrawl not configured" |
| `LOVABLE_API_KEY` | `chat` (proveedor por defecto) | 500 de configuración; `?health=1` lo marca como `missing` |
| `GROK_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` | `chat` (modelos de cada proveedor) | 500 solo al elegir esos modelos; aparecen desactivados en el selector |
| `OPENWEATHER_API_KEY` | `openweather`, `weather-grid` | 500 / sin datos |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | `air-traffic` | Con ellos sube la cuota de OpenSky; sin ellos se sigue sirviendo por ADSB.lol, que no necesita clave |
| `VESSELFINDER_API_KEY` | `marine-traffic` | Sin clave se usa el AIS abierto de Digitraffic (Báltico), que tampoco necesita clave |
| `NASA_FIRMS_MAP_KEY` (o `FIRMS_MAP_KEY`) | `globe-feeds` (feed `fires`) | Capa de incendios vacía |
| `CESIUM_ION_TOKEN` (o `VITE_CESIUM_TOKEN`) | `cesium-tiles` | Tiles sin autenticar |
| `GITHUB_PAT`, `GITHUB_REPO_ALLOWLIST` | `github-proxy` | 401/403 y allowlist vacía |
| `UFO_FEED_SECRET` | `ufo-feed` | 401 en todas las llamadas (es un cron) |
| `PAYOUT_WALLET_ADDRESS` | `_shared/uns.ts` | Sin fallback de cobro si el dominio Web3 no resuelve |

## Modelo de acceso

Ninguna función confía en el gateway para autorizar; cada una lleva su propio
control, y por eso **todas** están con `verify_jwt = false` en
`supabase/config.toml`:

- **Allowlist de origen + rate limit** (`_shared/guard.ts`): `air-traffic`,
  `cesium-tiles`, `firecrawl-search`, `globe-feeds`, `marine-traffic`,
  `openweather`, `osint-aggregator`, `weather-grid`, `web3-recipient`. Son
  proxies públicos de datos; la sesión no aporta nada y el origen sí limita el
  abuso.
- **Sesión de usuario** (validada dentro de la función con
  `admin.auth.getUser`): `github-proxy`, `verify-crypto-payment`,
  `verify-dao-holdings`.
- **Firma + sesión**: `wallet-auth` (firma el mensaje la wallet),
  `verify-dao-holdings` (firma + holdings NFT).
- **Secreto compartido**: `ufo-feed` (`UFO_FEED_SECRET`, lo llama un cron).

### Deriva de configuración

Una función **no declarada** en `config.toml` se despliega con `verify_jwt = true`
por defecto. Eso rompería `wallet-auth` (el login llega sin sesión todavía) y los
`verify-*`, que validan el token ellos mismos y necesitan que la petición llegue.
El 2026-10-20 faltaban siete declaraciones (`wallet-auth`,
`verify-crypto-payment`, `verify-dao-holdings`, `web3-recipient`, `globe-feeds`,
`firecrawl-osint`, `mcp`); se añadieron y `npm run edge:check` falla si vuelve a
ocurrir. `mcp` ya no existe: su servidor y su SDK se retiraron con el resto de la
integración de Lovable (ver `docs/lovable-supabase-migration.md`).

## Tráfico aéreo y marítimo: cobertura real

Ninguna de las dos funciones inventa ya tráfico. Hubo una etapa en la que
`air-traffic` respondía `generateMockFlights()` y `marine-traffic`
`generateMockShips()` cuando su upstream fallaba: con la clave de VesselFinder
sin configurar, el globo pintaba 40 barcos generados al azar en el Mediterráneo, y
OpenSky, que limita las llamadas anónimas a `/states/all`, hacía que casi todas
las peticiones aéreas acabaran en 50 vuelos inventados. Eso se ha eliminado de
las dos funciones: **cada fila viene de un receptor real** y, si ninguna fuente
responde, la respuesta lo dice con `unavailable: true` y la lista vacía.

Fuentes, en orden:

- **Aéreo** — OpenSky por caja (`/states/all`), con OAuth2
  cliente-credenciales si están `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`;
  si no responde, **ADSB.lol** (`/v2/point`), red comunitaria sin clave ni
  bloqueo por país. ADSB.lol se consulta por centro y radio, así que el área
  devuelta **cubre** la caja pedida sin coincidir exactamente con ella.
  ADSB.lol aporta además el tipo ICAO y la categoría de emisor ADS-B, que es lo
  que permite dibujar la silueta correcta de cada aeronave.
- **Marítimo** — VesselFinder si hay `VESSELFINDER_API_KEY`; si no, el AIS
  abierto de **Digitraffic** (Agencia de Transporte de Finlandia, CC BY 4.0), que
  no necesita clave y cubre el Báltico y la costa finlandesa. Esa limitación de
  cobertura se declara en el campo `coverage` en vez de disimularse.

Cuando ninguna fuente contesta, el pie del globo muestra `AÉREO SIN COBERTURA` /
`MARÍTIMO SIN COBERTURA` (antes `SIMULADO`, que describía un dato que ya no
existe). El monitor lo trata igual: `npm run edge:check -- --strict` avisa tanto
si una función antigua sigue respondiendo `mock: true` como si la nueva responde
`unavailable: true`.

## Pendiente de desplegar

Estos cambios están en `main` pero **no** están en producción hasta que se
ejecute `npm run edge:deploy` con un token:

- `air-traffic`: OAuth2 de OpenSky, se retira el generador de vuelos
  inventados, se añade ADSB.lol como respaldo sin clave y `destination` deja de
  mapear `state[3]` (un `time_position`, no una ruta) — ahora es `null`. Además,
  `latitude` y `longitude` dejan de estar cruzadas: `/states/all` devuelve la
  longitud en el índice 5 y la latitud en el 6, y leerlo al revés colocaba cada
  avión de OpenSky en el lado equivocado del planeta.
- `marine-traffic`: se retira el generador de barcos inventados y se añade el AIS
  abierto de Digitraffic como respaldo sin clave.

Mientras el despliegue esté pendiente, el cliente **descarta** las filas que
llegan con `mock: true`, así que una función antigua ya no puede pintar tráfico
inventado en el globo: la capa se ve vacía y marcada como sin cobertura. Cuando
se despliegue, esa marca desaparece sola.
- `crypto-signals`: una acción desconocida responde `400` con la lista de
  acciones válidas; antes devolvía `{}` con `200`, que se confundía con un feed
  vacío.
- `chat`: el informe `?health=1` y el registro de proveedores del que salen sus
  listas de modelos. Mientras la versión desplegada sea la anterior, un `GET`
  contesta `400 Invalid JSON`, así que `edge:check` marca `chat?health=1` como
  fallo y el selector muestra "claves sin verificar" (no desactiva nada).
- `mcp`: la carpeta se retiró del repositorio con el resto de la integración de
  Lovable, pero **la función sigue desplegada** y ya no aparece en `edge:check`.
  El inventario de funciones de más y el apagado seguro (tumba 410 → borrado)
  están en `docs/function-decommission-runbook.md`; a mano:
  `npx supabase functions delete mcp --project-ref wkdtvrxavkhbifjtvvdw`
  (requiere `SUPABASE_ACCESS_TOKEN` o un `supabase login`).
- `_shared/guard.ts`: allowlist sin hosts de Lovable. Afecta a las nueve funciones
  que usan `guardPublic`, así que **solo aplica al redesplegarlas**; hasta entonces
  producción sigue aceptando `*.lovable.app` como origen.

## Limitaciones de la verificación

- `npm run edge:check` prueba **producción**: si acabas de cambiar una función y
  no la has desplegado, el resultado es el de la versión anterior.
- Las funciones no se pueden compilar ni servir en local en este entorno: no hay
  `deno` ni `docker`, así que `supabase functions serve` no está disponible. La
  primera validación real de un cambio es el despliegue + `edge:check`.
- No hay tests unitarios de las funciones; la red de seguridad es el verificador.
- Los `429` del guard se reportan como aviso: repetir `edge:check` en menos de un
  minuto desde la misma IP puede agotar el límite de las funciones más
  restrictivas.
