# MCP en AI-TOR (arquitectura y cableado)

Servidor MCP local con tres herramientas, control de acceso por plan en la base
de datos y un bucle de *function calling* contra Gemini. Todo el código está en
`src/lib/mcp/` y `src/services/mcpClient.ts`; no hay SDK nuevo ni dependencia
añadida.

## Por qué sin SDK

El protocolo son cuatro métodos JSON-RPC (`initialize`, `ping`, `tools/list`,
`tools/call`). Implementarlos aquí evita acoplarse a la versión de un paquete y
permite que el mismo servidor corra en el navegador (herramientas públicas, RLS
del usuario) y en servidor (donde vive la clave del modelo). Para Gemini se usa
la **API REST** directamente, por el mismo motivo.

> Un detalle que ya costó un incidente: `api/predictions.ts` documenta que el
> runtime de Vercel no resolvió un import hermano (`./_venues`) y devolvía 500.
> Por eso **no** se ha creado `api/mcp.ts` importando `src/`: el handler es
> agnóstico (`src/lib/mcp/http.ts`) y se monta donde resuelva imports (backend
> Node, o una copia autocontenida si algún día va a Vercel).

## Piezas

| Fichero | Qué hace |
| --- | --- |
| `src/lib/mcp/types.ts` | Tipos MCP/JSON-RPC, planes (`free`/`pro`/`dao`) y códigos de error |
| `src/lib/mcp/registry.ts` | Registro: filtro por plan, `tools/list`, `tools/call`, despacho JSON-RPC |
| `src/lib/mcp/tools/satellites.ts` | `telemetry.satellites` — posiciones reales desde CelesTrak |
| `src/lib/mcp/tools/osint.ts` | `osint.events` — titulares de GDELT con fuente, enlace y tono |
| `src/lib/mcp/tools/database.ts` | `db.select` — tablas y columnas en lista blanca, RLS del llamante |
| `src/lib/mcp/gemini.ts` | Declaraciones de funciones, descubrimiento de modelo, límites y bucle |
| `src/lib/mcp/http.ts` | Handler `Request`/`Response`: JSON-RPC o `{ prompt }` |
| `src/services/mcpClient.ts` | Cliente de navegador: sesión, plan, herramientas y agente |
| `scripts/mcp-ask.ts` | CLI para probar el circuito completo |

## Herramientas y planes

| Herramienta | Plan mínimo | Fuente |
| --- | --- | --- |
| `telemetry.satellites` | `free` | CelesTrak TLE + `satellite.js` |
| `osint.events` | `free` | GDELT DOC 2.0 |
| `db.select` | `pro` | Supabase, con RLS |

El plan se comprueba **dos veces**: al listar y al ejecutar. Listar no basta,
porque un cliente puede pedir una herramienta que nunca llegó a listar.

## Control de acceso en la base de datos

`supabase/migrations/20261029130000_profiles_tier.sql`:

- `profiles.tier` con `check (tier in ('free','pro','dao'))` y `free` por defecto.
- RLS: cada cuenta ve y edita sólo su fila.
- **El usuario no puede ascenderse**: se revoca `UPDATE` de tabla y se concede
  por columnas (`display_name`, `avatar_url`, `updated_at`). Un
  `PATCH /profiles {"tier":"dao"}` responde 403, no cambia nada.
- Trigger en `auth.users`: toda cuenta nueva nace con perfil `free`, sin
  depender de que el frontend se acuerde.

Los planes de pago los escribe el servidor (`service_role`) cuando el pago o el
holding se verifican, como ya hacen `verify-crypto-payment` y
`verify-dao-holdings`.

## Gemini

- Clave: `GEMINI_API_KEY`, **sólo en servidor**. Nunca con prefijo `VITE_`, o
  Vite la mete en el bundle.
- Modelo: **`gemini-1.5-flash` está retirado** (la API responde
  `404 models/gemini-1.5-flash is not found`). Si no se fija `GEMINI_MODEL`, el
  cliente consulta `/models` y elige el Flash más reciente que admita
  `generateContent`, descartando embeddings, imagen, TTS y previews.
- Límites del free tier: 10 peticiones/minuto y 1500/día
  (`FREE_TIER_LIMITS`). Es una defensa en memoria por proceso; la cuota real la
  impone Google.
- El bucle está acotado a 3 rondas (`maxRounds`): un modelo empeñado en llamar
  herramientas no puede gastar la cuota de un turno en llamadas.

## Probar sin desplegar

```bash
GEMINI_API_KEY=... npx tsx scripts/mcp-ask.ts "¿dónde está la ISS ahora?"
MCP_TIER=pro GEMINI_MODEL=gemini-3.8-flash npx tsx scripts/mcp-ask.ts "dame mi plan"
```

El CLI imprime las herramientas visibles para el plan, las que usó el modelo y
la respuesta. Sin sesión no hay `db.select`, así que ese caso sólo se prueba con
el servidor montado.

## Montar el handler

```ts
import { createMcpHttpHandler } from "../src/lib/mcp/http";
import { createAiTorMcpServer } from "../src/lib/mcp/index";
import { createGeminiClient, createRateLimiter, runToolLoop } from "../src/lib/mcp/gemini";

const server = createAiTorMcpServer({ db: /* puerto REST con el JWT del llamante */ });

const handler = createMcpHttpHandler({
  server,
  resolveCaller: async (request) => {
    const user = await verifyUser(request.headers.get("authorization") ?? undefined);
    if (!user) return null;
    return { tier: await tierOf(user), db };
  },
  agent: async (prompt, caller) => {
    const result = await runToolLoop({
      client: createGeminiClient({ apiKey: process.env.GEMINI_API_KEY! }),
      server,
      context: { tier: caller.tier, db: caller.db, fetch },
      prompt,
      limiter,
    });
    return { answer: result.text, toolCalls: result.toolCalls };
  },
});
```

`backend/server.ts` ya verifica JWT (`verifyUser`) y ya tiene `GEMINI_API_KEY`,
así que es el sitio natural: el handler es un `(Request) => Response` y se puede
adaptar a Express leyendo el cuerpo y devolviendo `res.status(...).send(...)`.

## Lo que queda fuera a propósito

- Escrituras: ninguna herramienta escribe. `db.select` es lectura, con lista
  blanca de tablas y columnas.
- Recursos y prompts MCP: sólo se implementan herramientas.
- Persistencia de la cuota: el limitador es por proceso; para cuotas exactas hay
  que contar en la base de datos.
