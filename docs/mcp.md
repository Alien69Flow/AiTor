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
> Por eso el handler es agnóstico (`src/lib/mcp/http.ts`) y se monta donde
> resuelvan los imports. Hoy hay **dos** montajes del mismo handler:
> `backend/mcp.ts` (Express) y `api/mcp.ts` (función de Vercel), porque el
> cliente del chat llamaba a `/api/mcp` desde el principio y esa ruta no existía:
> en producción el botón de herramientas daba 404. Si el runtime de Vercel vuelve
> a fallar al resolver los imports de `src/lib/mcp/…`, el montaje de referencia
> sigue siendo el backend Node.

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
| `github.repo` | `free` | Proxy de GitHub (lectura) |
| `db.select` | `pro` | Supabase, con RLS |
| `github.propose` | `pro` | Proxy de GitHub (rama + PR en borrador) |

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

## Montado en el backend Node

`backend/mcp.ts` es el punto de montaje real, montado en `backend/server.ts`:

| Ruta | Qué hace |
| --- | --- |
| `POST /mcp` | JSON-RPC (`initialize`, `ping`, `tools/list`, `tools/call`) |
| `POST /mcp` con `{ prompt }` | Bucle de Gemini con las herramientas del plan |
| `GET /mcp/tools` | Herramientas visibles para quien llama, con su plan |

Lo que aplica el router y no se puede delegar al cliente:

- El plan se lee de `profiles.tier` con el JWT del llamante; el cuerpo nunca lo trae.
- `db.select` consulta con **ese** JWT, así que el RLS decide las filas.
- Cada usuario tiene su propio cubo de cuota del free tier.
- `GEMINI_API_KEY` no sale del proceso.

```bash
cd backend && npm install --legacy-peer-deps   # el paquete tiene su propio lock
GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run dev
curl -s localhost:4000/mcp/tools -H "Authorization: Bearer $JWT"
```

`npm run install` normal falla por un conflicto de peers **preexistente**
(`langchain@0.3` con el SDK de Google); `--legacy-peer-deps` lo resuelve sin tocar
el `package.json`. El paquete tampoco compilaba antes de este cambio: sus agentes
importan `@langchain/google-genai`, que no está declarado, y usan imports sin
extensión bajo `NodeNext`. `backend/mcp.ts` sí compila aislado y tiene una prueba
de humo (`npx tsx mcp.smoke.ts`) que comprueba los 401 sin salir a la red.

## Botón en el chat

`src/components/chat/McpToolsButton.tsx` lista las herramientas del plan real y
ejecuta una con valores por defecto. El filtrado lo hace el servidor; el botón
sólo pinta lo que recibe.

## GitHub: leer el repo y proponer mejoras

`src/lib/mcp/tools/github.ts` da a AI Tor dos capacidades sobre su propio
repositorio:

- `github.repo` lee árbol, ficheros, commits, PRs abiertos y checks de CI. Es la
  lectura con la que detecta qué está roto y qué merece una mejora.
- `github.propose` crea una rama, escribe un fichero y abre un **PR en
  borrador**. Nunca escribe en `main`: la mejora queda propuesta.

Ninguna herramienta lleva credenciales. Las dos hablan por un puerto
(`context.github`) que en el navegador es `githubPort`
(`src/services/mcpClient.ts`) y envía la acción al proxy con la **sesión del
usuario**. El token de servicio y la allowlist de repositorio viven en
`supabase/functions/github-proxy`, que exige identidad verificada en todas las
acciones y rol `admin` en las de escritura (`create_branch`,
`create_or_update_file`, `create_pull_request`).

El proxy se despliega en el **proyecto de identidad**, porque es el único que
puede validar ese JWT. Si no está allí, la herramienta responde que falta el
proxy en vez de un 401 mudo.

Para que el modelo lo use en el bucle de servidor, `/api/mcp` tendría que
montar su propio puerto; hoy esa copia autocontenida no incluye estas dos
herramientas, así que el agente del servidor no las ve y el del navegador sí.

## Lo que queda fuera a propósito

- Escrituras: la base de datos sigue siendo sólo lectura (`db.select`, con lista
  blanca de tablas y columnas). La única escritura posible es `github.propose`,
  que va a una rama y a un PR en borrador, y el proxy la limita a `admin`.
- Recursos y prompts MCP: sólo se implementan herramientas.
- Persistencia de la cuota: el limitador es por proceso; para cuotas exactas hay
  que contar en la base de datos.
