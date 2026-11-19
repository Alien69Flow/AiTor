# Roadmap de AiTor

**Única fuente de verdad.** `AGENTS.md` describe la arquitectura; aquí está qué
está hecho, qué está desplegado y qué falta. Si los dos ficheros discrepan, manda
este.

**Última verificación: 19 de noviembre de 2026**, contra
`https://aitor.alienflow.space` y el proyecto Supabase `wkdtvrxavkhbifjtvvdw`.

## Cómo se lee

| Marca | Significa |
|---|---|
| ✅ | **Desplegado y comprobado.** Mergeado en `main` *y* respondiendo en producción; al lado va la comprobación que lo demuestra. |
| 🟡 | **En `main`, pero no sirviendo.** Falta desplegar o faltan variables. No cuenta como hecho. |
| ⬜ | **Pendiente.** No hay código. |

Un ✅ pide las dos cosas a la vez. Que el fichero exista en el repo no es estar en
producción: `backend/` entero está en ese caso (nada lo arranca: ni `package.json`,
ni `vercel.json`, ni un Dockerfile).

## Comprobarlo tú mismo

```bash
# 1. El webhook vive, Telegram apunta donde debe y el bot se identifica
curl -s https://aitor.alienflow.space/api/telegram-webhook | jq '{secretConfigured, webhook, bot}'

# 2. La función de chat y su clave de proveedor
curl -s 'https://aitor.alienflow.space/api/telegram-webhook?probe=1' | jq .chatProbe.conclusion

# 3. La memoria del hilo: 404 = no desplegada
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://wkdtvrxavkhbifjtvvdw.supabase.co/functions/v1/chat-thread
```

---

# Parte A · El bot (fases cerradas y a medio cerrar)

## Fase 1 — Decir la verdad cuando algo falla ✅

Antes cualquier fallo se contestaba con una frase amable («mi núcleo está
recalibrando frecuencias»), así que una clave inválida podía durar días sin que
nadie lo supiera.

- [x] Clasificar el fallo (credencial, cuota, red, proveedor, tiempo agotado) y decir cuál es — #102, #108
- [x] Sonda `GET /api/telegram-webhook?probe=1`: comprobación gratuita siempre y, con `x-api-key`, una llamada real al modelo — #102, #105
- [x] El webhook ya no contesta 200 mudo: un fallo deja rastro en los logs de Vercel

**Comprobado:** `?probe=1` responde con `salud → 200` y una conclusión que nombra
el extremo que falla (hoy: «chat vive»).

## Fase 2 — La credencial correcta ✅

- [x] `pickSupabaseKey` prefiere una JWT anon y descarta la `sb_publishable_…`, que el gateway rechaza con 401 — #103
- [x] La clave no se imprime nunca: sólo su procedencia y su forma

**Comprobado:** la función `chat` contesta `200` a su informe de salud a través
del webhook desplegado.

## Fase 3 — Memoria del hilo 🟡

El bot recuerda la conversación anterior. Está escrito, mergeado y con migración,
pero **la función no está desplegada**: `POST /functions/v1/chat-thread` devuelve
`404 NOT_FOUND`.

- [x] Migración `supabase/migrations/20261118190000_chat_memory.sql`
- [x] Función `supabase/functions/chat-thread` (lee y guarda turnos con la service key)
- [x] El webhook la llama con un identificador opaco: HMAC del `chat_id`, no el `chat_id` — #103
- [ ] Aplicar la migración
- [ ] Desplegar la función

**Para cerrarla:**

```bash
supabase db push --project-ref pnyigikagdxqaogbiift
supabase functions deploy chat-thread --project-ref pnyigikagdxqaogbiift
```

**Criterio de hecho:** la sonda 3 deja de dar 404 y, hablando con el bot, el
segundo mensaje recuerda el primero. Si el turno quedara duplicado, falta la
Fase 6.

## Fase 4 — Conocimiento curado ✅

- [x] `api/_shared/knowledge.ts`: sólo se inyecta lo que cae en el dominio (física 3-6-9, DAO, tokenómica) y el modelo recibe la orden de citarlo — #104
- [x] Se pasa como `context` en el turno, no como texto pegado al prompt

**Comprobado:** desplegado con el webhook (una pregunta fuera de dominio no lo
recibe). No hay sonda específica: se verifica preguntando.

## Fase 5 — Alertas de precio 🟡

`/alerta BTC > 95000` existe en el bot y el cron está declarado en `vercel.json`
(`/api/cron/price-alerts`, `17 9 * * *`), pero **está inerte**: sin `CRON_SECRET`
responde 401, y sin Redis no puede guardar ni leer avisos.

- [x] Comando `/alerta` con formato claro, tope de avisos por chat y símbolos acotados — #105
- [x] Endpoint de cron protegido por secreto
- [ ] Redis en Vercel (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)
- [ ] `CRON_SECRET` puesto y cron probado de punta a punta

**Criterio de hecho:** crear un aviso desde el bot, forzar el cron con
`Authorization: Bearer $CRON_SECRET` y recibir el mensaje cuando se cruza el
precio.

## Fase 6 — Deduplicar entregas de Telegram 🟡

Si Telegram reintenta una entrega, el usuario recibía la respuesta dos veces y el
turno se guardaba duplicado.

- [x] `update_id` reservado en Redis (`SET … NX EX 600`, diez minutos) **antes** de procesar — #109
- [x] Clave con prefijo de entorno: una preview no gasta updates reales
- [x] Sin Redis se procesa igual y se avisa en el log (mejor respuesta doble que silencio)
- [x] Prueba de punta a punta: dos entregas con el mismo `update_id` → un solo mensaje y una sola reserva; con `update_id` nuevo → se contesta
- [ ] Redis configurado (el mismo de la Fase 5) — hoy `GET /api/health?compact=1` responde `UNCONFIGURED`

**Criterio de hecho:** con Redis puesto, dos peticiones con el mismo `update_id`
producen una sola respuesta y un solo turno guardado.

## Fase 7 — La CI no miente ✅

- [x] `api/**` dentro de la suite de Vitest (#107) y tests/lint bloqueantes en el workflow (#110)
- [x] Los cinco fallos que estaban ocultos, arreglados: `chat-thread` declarada en `config.toml`, marcador de ruleta, `localStorage` en jsdom, dos errores de lint

**Comprobado:** 121 ficheros, 1072 tests en verde; `eslint` sin errores; job de
CI en verde en el commit mergeado `9944670`.

## Fase 8 — Webhook firmado 🟡

Hoy `secretConfigured: false`: se aceptan actualizaciones sin firmar con cuota por
IP (30/min). Funciona, pero cualquiera puede gastar cuota de modelo.

- [x] Verificación en tiempo constante cuando el secreto existe
- [ ] `TELEGRAM_WEBHOOK_SECRET` en Vercel y re-registrar el webhook con `node scripts/telegram-webhook.mjs --set`

**Criterio de hecho:** `secretConfigured: true` y el bot sigue respondiendo.

---

# Parte B · Producto (⬜ pendiente)

Nada de esta parte está desplegado. El código de `backend/` (agentes, workflows,
RAG, loops) existe pero **nada lo arranca**, así que aquí no cuenta como hecho.

## Fase 9 — Agentes de mercado

Análisis técnico, señales, seguimiento de cartera y DeFi.

**Criterio de hecho:** un comando del bot devuelve una señal con fuente, hora y
precio verificables, y desde `backend/` desplegado (no desde el portátil).

## Fase 10 — Workflows con aprobación humana

Trading semi-automatizado, investigación multi-agente y respuesta a crisis. Nada
se ejecuta sin que una persona apruebe.

**Criterio de hecho:** una propuesta llega al usuario, se aprueba o rechaza desde
el bot, y queda registro de quién aprobó qué y cuándo.

## Fase 11 — Globo: capas con fuente y fecha

- [x] Temperatura, humedad, presión/isobaras, precipitación y viento con telemetría independiente *(en la app web, no en el bot)*
- [ ] Mareas (dirección, velocidad, altura) con fuente oceánica pública
- [ ] Vista orbital: Sol, Luna, planetas, asteroides y satélites
- [ ] Controles de tiempo y altitud: superficie, atmósfera, órbita
- [ ] DeFi TVL, adopción cripto, mapa regulatorio, minas y exchanges
- [ ] Frescura visible y ninguna capa con respaldo inventado

**Criterio de hecho:** cada capa dice su fuente y la hora del dato; si el dato no
llega, se ve vacío en vez de relleno.

## Fase 12 — DAO City

- [x] Ciudad holográfica 3D con distritos seleccionables *(en la app web)*
- [x] Encargos por distrito conectados al chat con entregables reales *(en la app web)*
- [ ] Formación con evaluaciones y graduación persistente (faltan criterios de acreditación)
- [ ] Trabajo autónomo y ciudad multiusuario (faltan permisos y aprobación de acciones externas)

**Criterio de hecho:** un encargo produce un entregable que se puede abrir, y el
progreso sobrevive a recargar la página.

## Fase 13 — Mercados y sistema, dentro de la app

TradingView, cartera con P&L, DeFi (TVL, yields, gas) e infraestructura de
observabilidad (cola, latencia, errores, coste).

**Criterio de hecho:** cada panel declara su fuente y su frescura; ninguno
inventa un número cuando la fuente calla.

## Fase 14 — Integraciones avanzadas

Blockchain (Ethereum, Solana, Bitcoin, L2), DEX y proveedores de datos
(CoinGecko, DeFiLlama, Dune…). Sólo con clave propia y cuota conocida.

**Criterio de hecho:** una integración nueva entra con prueba de que responde y
con un límite de gasto escrito.

---

# Cómo trabajar esto

1. **Una fase a la vez.** Se abre rama, se hace el cambio, se verifica y sólo
   entonces se mergea.
2. **✅ sólo cuando responde en producción**, con la sonda al lado. Un merge no
   es un despliegue.
3. **Si falta una variable o un despliegue, se dice en la fase** (🟡 con los pasos
   exactos), no se marca como hecha.
4. **Cada fase nueva entra aquí con su criterio de hecho**: qué se ejecuta para
   saber que está terminada. Si no se puede comprobar, no es una fase, es una
   idea.

## Registro

| Fecha | Cambio |
|---|---|
| 2026-11-19 | La reserva del `update_id` baja de 24 h a 10 min: el reintento que importa llega en segundos o minutos, y 24 h sólo llenaba el Redis de caché. Con su prueba de punta a punta. Sigue en 🟡: sin Redis configurado no deduplica. |
| 2026-11-19 | Este fichero pasa a ser la única fuente de verdad. Se retira el roadmap duplicado de `AGENTS.md`. Las fases del bot (1–8) reflejan PRs #102–#110; la memoria del hilo, las alertas y el dedupe quedan en 🟡 porque dependen de despliegues y variables que aún no están. |
