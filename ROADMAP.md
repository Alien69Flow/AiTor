# Roadmap de AiTor

**Única fuente de verdad.** `AGENTS.md` describe la arquitectura; aquí está qué
falta y **cómo se comprueba**. Si los dos ficheros discrepan, manda este.

Aquí no hay ✅ escritos a mano. Cada fase dice qué comando la comprueba y qué
tiene que salir; el estado de producción lo imprime la sonda, no una memoria de
la última vez que alguien miró.

## Cómo se comprueba

```bash
npm run verify:prod                      # memoria, cron, conocimiento, salud y webhook de una pasada
npm run verify:prod -- --only=memoria    # una sola cosa
npm run verify:prod -- --run-cron        # ejecuta el cron de verdad (puede enviar avisos)
npm run verify:prod -- --json            # para máquinas
```

| Código | Significa |
|---|---|
| `0` | Todo lo comprobado responde. Los avisos no lo impiden. |
| `1` | Algún fallo: producción no cumple el criterio de alguna fase. |
| `2` | Nada falló, pero algo quedó **sin verificar** (por ejemplo, falta una clave local). |

La sonda ([`scripts/verify-production.mjs`](scripts/verify-production.mjs)) hace
cinco comprobaciones, nunca imprime claves y las saca como tabla: una fila por
comprobación con **Hecho** en `sí` / `parcial` / `no` / `sin verificar`.

- **memoria** — ida y vuelta real de las tres capas (título, resumen y
  evidencia) en el hash de Redis del token, con un hilo de usar y tirar; la
  sonda se borra siempre. Sin las variables de Upstash queda en ⏭, no en verde.
- **cron** — sin `Authorization` tiene que dar 401. Con `--run-cron` y
  `CRON_SECRET` se ejecuta de verdad; `sin-redis` cuenta como fallo, porque sin
  almacén no puede disparar nada.
- **conocimiento** — `GET /api/telegram-webhook?probe=1` lanza
  `retrieveKnowledge` con dos preguntas de muestra (DAO y física) y dice qué
  bloque salió; sin ese campo en la respuesta queda sin verificar.
- **health** — `/api/health?compact=1` responde con veredicto y upstreams; avisa
  si falta Redis o si Telegram/chat están caídos.
- **webhook** — vive, identifica al bot, apunta a la URL buena, sin entregas
  pendientes, y dice si la firma está activa.

## Fase → comprobación

| Fase | Comando | Verde cuando |
|---|---|---|
| 1 · Decir la verdad al fallar | `npm run verify:prod -- --only=webhook` | El webhook responde y la conclusión del chat nombra el extremo que falla, no una frase amable. |
| 2 · La credencial correcta | `npm run verify:prod -- --only=health` | El detalle no dice `chat DOWN`: la función `chat` contesta con la JWT. |
| 3 · Memoria del hilo | `npm run verify:prod -- --only=memoria` | Título, resumen y evidencia de ida y vuelta y borrada (no ⏭: hacen falta las variables de Upstash). |
| 4 · Conocimiento curado | `npm run verify:prod -- --only=conocimiento` | Los dos bloques de muestra se recuperan en producción (y `npx vitest run api/telegram-knowledge.test.ts` verde). |
| 5 · Alertas de precio | `npm run verify:prod -- --only=cron --run-cron` | Sin `sin-redis` y sin `failures`; un `/alerta` creado desde el bot llega cuando se cruza. |
| 6 · Deduplicar entregas | `npm run verify:prod -- --only=health` + `npx vitest run tests/api/telegram-retry.test.ts` | Health no dice «falta Redis» y el test de reintentos está verde. |
| 7 · La CI no miente | `npm test && npm run lint && npm run typecheck` | Los tres verdes, y el check `build` del head mergeado en verde. |
| 8 · Webhook firmado | `npm run verify:prod -- --only=webhook` | El detalle dice `firma activa`. |
| 9–14 · Producto | Ver el criterio de cada fase | Hoy no hay sonda automática: el criterio es un observable concreto. |

---

# Parte A · El bot

## Fase 1 — Decir la verdad cuando algo falla

Antes cualquier fallo se contestaba con una frase amable («mi núcleo está
recalibrando frecuencias»), así que una clave inválida podía durar días sin que
nadie lo supiera.

- Clasificar el fallo (credencial, cuota, red, proveedor, tiempo agotado) y decir cuál es — #102, #108
- Sonda `GET /api/telegram-webhook?probe=1`: comprobación gratuita siempre y, con `x-api-key`, una llamada real al modelo — #102, #105
- El webhook ya no contesta 200 mudo: un fallo deja rastro en los logs de Vercel

**Comprobación:** `npm run verify:prod -- --only=webhook` (el detalle incluye la
conclusión de la sonda) y `npx vitest run api/_shared/chat-failure.test.ts`.

## Fase 2 — La credencial correcta

- `pickSupabaseKey` prefiere una JWT anon y descarta la `sb_publishable_…`, que el gateway rechaza con 401 — #103
- La clave no se imprime nunca: sólo su procedencia y su forma

**Comprobación:** `npm run verify:prod -- --only=health`. Verde cuando el chat
aparece `OK`; si aparece `DOWN`, el detalle de la sonda no basta y hay que mirar
`/api/telegram-webhook?probe=1`.

## Fase 3 — Memoria del hilo

El bot recuerda la conversación anterior. El webhook no llama a ninguna función
de Supabase para esto: guarda el hilo en Redis, en un hash por token con tres
capas —título, resumen y evidencia— bajo el mismo token opaco `tg_…`. No hace
falta aplicar migraciones ni dar service key al webhook.

- Almacén `api/_shared/thread-memory.ts` (tres capas, ventana de 8 mensajes de evidencia, caducidad de 6 h y TTL de 30 días)
- La migración `20261118190000_chat_memory.sql` sigue en el repositorio para la ruta de la función `chat`, que no es la del bot
- **Pendiente:** poner `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` en Vercel

**Comprobación:** `npm run verify:prod -- --only=memoria`. Sin las variables de
Upstash da ⏭: el bot funciona pero no recuerda.

## Fase 4 — Conocimiento curado

- `api/_shared/knowledge.ts`: sólo se inyecta lo que cae en el dominio (física 3-6-9, DAO, tokenómica) y el modelo recibe la orden de citarlo — #104
- Se pasa como `context` en el turno, no como texto pegado al prompt

**Comprobación:** `npm run verify:prod -- --only=conocimiento` (sonda remota:
`?probe=1` recupera el bloque `dao` y el `physics` con preguntas de muestra) y
`npx vitest run api/telegram-knowledge.test.ts`. En el bot, una pregunta de la
DAO seguida de otra de mercados: la primera cita la fuente y la segunda no
lleva contexto inventado.

## Fase 5 — Alertas de precio

`/alerta BTC > 95000` existe en el bot y el cron está declarado en `vercel.json`
(`/api/cron/price-alerts`, `17 9 * * *`). Sin Redis no guarda avisos; sin
`CRON_SECRET` responde 401 y no ejecuta.

- Comando `/alerta` con formato claro, tope de avisos por chat y símbolos acotados — #105, #113, #118
- Endpoint de cron protegido por secreto
- **Pendiente:** Redis en Vercel (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) y `CRON_SECRET`

**Comprobación:** `npm run verify:prod -- --only=cron --run-cron`. Verde cuando
la puerta da 401 sin secreto, la ejecución responde 200 y el cuerpo no dice
`sin-redis` ni trae `failures`. Después, un aviso real: crearlo con `/alerta`,
cruzarlo y recibir el mensaje.

## Fase 6 — Deduplicar entregas de Telegram

- `update_id` reservado en Redis (`SET … NX EX 600`) **antes** de procesar — #109
- Clave con prefijo de entorno: una preview no gasta updates reales
- Sin Redis se procesa igual y se avisa en el log

**Comprobación:** `npm run verify:prod -- --only=health` (sin «falta Redis») y
`npx vitest run tests/api/telegram-retry.test.ts`. La prueba de punta a punta es
dos entregas con el mismo `update_id`: una respuesta y una reserva.

## Fase 7 — La CI no miente

- `api/**` dentro de la suite de Vitest (#107) y tests/lint bloqueantes en el workflow (#110)
- Los cinco fallos que estaban ocultos, arreglados: `chat-thread` declarada en `config.toml`, marcador de ruleta, `localStorage` en jsdom, dos errores de lint

**Comprobación:** `npm test && npm run lint && npm run typecheck`, y el check
`build` en verde en el head que se mergea. Un merge con `build` rojo no es una
fase hecha.

## Fase 8 — Webhook firmado

- Verificación en tiempo constante cuando el secreto existe
- **Pendiente:** `TELEGRAM_WEBHOOK_SECRET` en Vercel y re-registrar con `node scripts/telegram-webhook.mjs --set`

**Comprobación:** `npm run verify:prod -- --only=webhook`. Hoy da aviso («sin
firma»); verde cuando diga `firma activa` y el bot siga respondiendo.

---

# Parte B · Producto

Nada de esta parte está desplegado. El código de `backend/` (agentes, workflows,
RAG, loops) existe pero **nada lo arranca**, así que no cuenta como hecho.

## Fase 9 — Agentes de mercado

**Criterio:** un comando del bot devuelve una señal con fuente, hora y precio
verificables, servida desde `backend/` desplegado (no desde el portátil).
**Comprobación:** manual, con el comando y la URL de la fuente al lado. Cuando
haya endpoint, entra aquí con su `--only`.

## Fase 10 — Workflows con aprobación humana

**Criterio:** una propuesta llega al usuario, se aprueba o rechaza desde el bot,
y queda registro de quién aprobó qué y cuándo.
**Comprobación:** manual: aprobar una propuesta y verla en el registro; rechazar
otra y comprobar que no se ejecutó.

## Fase 11 — Globo: capas con fuente y fecha

- Temperatura, humedad, presión/isobaras, precipitación y viento con telemetría independiente *(en la app web, no en el bot)*
- Mareas (dirección, velocidad, altura) con fuente oceánica pública — `TidesCard` con Open-Meteo Marine, fuente, cobertura y hora; sin dato dice «sin cobertura» — #114 *(en la app web)*
- **Pendiente:** vista orbital, controles de tiempo y altitud, DeFi TVL, mapa regulatorio, frescura visible

**Criterio:** cada capa dice su fuente y la hora del dato; si el dato no llega,
se ve vacío en vez de relleno.
**Comprobación:** manual sobre el globo, capa por capa: fuente visible, hora
visible y estado vacío al cortar la fuente.

## Fase 12 — DAO City

- Ciudad holográfica 3D con distritos seleccionables *(en la app web)*
- Encargos por distrito conectados al chat con entregables reales *(en la app web)*
- **Pendiente:** formación con acreditación y ciudad multiusuario

**Criterio:** un encargo produce un entregable que se puede abrir, y el progreso
sobrevive a recargar la página.
**Comprobación:** manual: abrir el entregable y recargar.

## Fase 13 — Mercados y sistema, dentro de la app

**Criterio:** cada panel declara su fuente y su frescura; ninguno inventa un
número cuando la fuente calla.
**Comprobación:** manual: cortar una fuente y ver que el panel queda vacío con
aviso, no con un cero.

## Fase 14 — Integraciones avanzadas

**Criterio:** una integración nueva entra con prueba de que responde y con un
límite de gasto escrito.
**Comprobación:** manual: la prueba de respuesta y el límite, en el PR.

---

# Cómo trabajar esto

1. **Una fase a la vez.** Rama, cambio, verificación, merge.
2. **El estado no se escribe a mano.** Si una fase no tiene un comando en la
   tabla de arriba, todavía no está terminada: le falta criterio.
3. **Si falta una variable o un despliegue, se dice en la fase** con los pasos
   exactos; no se maquilla de hecho.
4. **Cada fase nueva entra con su `--only`** en `verify-production.mjs`. Si no
   se puede comprobar desde fuera, no es una fase, es una idea.

## Registro

| Fecha | Cambio |
|---|---|
| 2026-11-20 | La memoria del hilo pasa de la función `chat-thread` (404) a Postgres por PostgREST, sin CLI de Supabase ni Redis. Sigue pendiente aplicar la migración y poner la service key en Vercel; la sonda lo dice en ⏭/❌, no en verde. |
| 2026-11-20 | `npm run verify:prod` comprueba webhook, salud, memoria y cron de una pasada, con códigos 0/1/2. El ROADMAP deja de llevar ✅ escritos a mano: cada fase apunta a su comprobación. |
| 2026-11-19 | Mareas en el globo: tarjeta con nivel del mar y corriente superficial de Open-Meteo Marine (sin clave) para 24 puertos de referencia. Dice fuente, cobertura y hora; sin dato pone «sin cobertura» o «la fuente no responde», nunca cero. **No** sustituye a las boyas NOAA del ticker. |
| 2026-11-19 | La reserva del `update_id` baja de 24 h a 10 min: el reintento que importa llega en segundos o minutos. Sigue pendiente Redis configurado. |
| 2026-11-19 | Este fichero pasa a ser la única fuente de verdad. Se retira el roadmap duplicado de `AGENTS.md`. |
