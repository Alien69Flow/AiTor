# Fase 5 · el cron de alertas, de punta a punta

El código ya está desplegado: `/api/cron/price-alerts` responde, la puerta da 401
sin secreto y `vercel.json` lo programa a las 09:17 UTC. Lo que falta no es
código, son tres variables en Vercel. Con esto puesto, la fase se comprueba sola
y se puede enseñar el aviso llegando.

**Comando de la fase:** `npm run verify:prod -- --only=cron --run-cron`, y
después un aviso real creado desde el bot y recibido en Telegram.

## 1 · Las variables, con su nombre exacto

| Variable | De dónde sale | Qué **no** es |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | La URL REST de la base en el panel de Upstash (empieza por `https://` y termina en `.upstash.io`) | La URL del dashboard ni la de la consola de Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | El token REST de esa misma base | El token de sólo lectura |
| `CRON_SECRET` | **La generas tú**: `openssl rand -hex 32` | No se copia de ningún sitio, y no se pega en el chat ni en el repo |

El código acepta también los alias que crea la integración de Upstash en Vercel,
`KV_REST_API_URL` y `KV_REST_API_TOKEN` (`firstEnv` en `api/_shared/redis.ts`).
Si están las dos parejas, gana `UPSTASH_*`. Con una pareja basta.

- **Entorno:** Production. En Preview se pueden poner las mismas: el código
  prefija las claves con `<entorno>:<sha>:` (`keyPrefix()`), así que una preview
  no ve ni pisa los datos de producción.
- **`CRON_SECRET` hace dos trabajos:** Vercel lo manda solo en la llamada de su
  cron (`Authorization: Bearer …`), y la sonda lo usa para ejecutarlo a mano.
  Sin él, la ejecución de las 09:17 responde **401** y no dispara nada.
- **Sin Redis** el cron responde `200 {"ok":true,"checked":0,"reason":"sin-redis"}`
  a propósito: un cron que falla en silencio es peor que uno que no hace nada.
  La sonda lo cuenta como **fallo**, no como verde.
- **Después de añadirlas hay que redesplegar**: cada despliegue lee su propio
  entorno.
- Las mismas dos de Redis desbloquean también la memoria del hilo (fase 3) y el
  dedupe de entregas (fase 6). Se pone una vez y valen para tres fases.

## 2 · Comprobar que llegaron

```bash
npm run verify:prod -- --only=health
```

Antes decía `falta Redis: la frescura no se puede comprobar`. Ahora tiene que
decir `telegram OK · chat OK` sin ese aviso. Si sigue apareciendo, la variable
no llegó al despliegue que sirve: revisa el entorno y vuelve a desplegar.

```bash
npm run verify:prod -- --only=memoria
```

Pasa de `⏭ falta UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN` a un
resultado real. Es la prueba de que el token **escribe**, no sólo lee.

## 3 · La puerta (esto ya está verde hoy)

```bash
npm run verify:prod -- --only=cron
# → protegido: 401 sin Authorization
```

## 4 · Ejecución real, todavía sin avisos

```bash
CRON_SECRET=<el que hayas generado> npm run verify:prod -- --only=cron --run-cron
# → 0 avisos · 0 disparados · 0 entregados
```

El secreto va delante del comando o en tu `.env.local`, que no se sube. El
script lee el entorno y, si no, `.env` / `.env.local`. Nunca lo pegues en el
chat: si se filtra, hay que rotarlo en Vercel y volver a desplegar.

## 5 · Punta a punta de verdad: dos avisos, uno cruza y otro no

En el bot, dos mensajes:

```
/alerta BTC > 1
→ ✅ Aviso creado: BTC ≥ $1. Te escribo cuando lo cruce.

/alerta BTC > 1000000
→ ✅ Aviso creado: BTC ≥ $1.000.000. Te escribo cuando lo cruce.
```

El primero ya está cruzado (BTC vale mucho más que 1); el segundo no lo estará.

```bash
CRON_SECRET=<el tuyo> npm run verify:prod -- --only=cron --run-cron
# → 2 avisos · 1 disparados · 1 entregados
```

Y en Telegram llega el aviso con el precio de la fuente en ese momento:

```
🔔 BTC está en $<precio real de CoinGecko> (aviso: ≥ $1).
```

Segunda pasada, sin crear nada:

```bash
CRON_SECRET=<el tuyo> npm run verify:prod -- --only=cron --run-cron
# → 1 avisos · 0 disparados · 0 entregados
```

Por qué esas dos líneas demuestran la fase entera:

- `2 avisos` → el cron lee el almacén y los dos avisos están guardados.
- `1 disparados` → sólo el cruzado dispara (`isDue` compara con el precio de
  ahora, no con el de cuando se creó).
- `1 entregados` → sólo sube si Telegram aceptó el `sendMessage`; si el envío
  falla, el aviso **no** se borra y se reintenta en la siguiente pasada.
- `1 avisos` en la segunda → el disparado se borró (una alerta es de un solo
  uso) y el que no cruzó sigue vivo.

Para terminar, `/alerta BTC < 1` crea un tercero que tampoco cruzará: el tope es
10 avisos por chat y caducan a los 30 días.

## 6 · Lo que esto no prueba

- **El horario de Vercel.** Que el cron de las 09:17 se dispare lo dirá el
  registro de la función `/api/cron/price-alerts` en Vercel → Logs, al día
  siguiente. Aquí se prueba la ejecución, no el reloj.
- **Sismos y GDELT.** `/alerta sismos 5.5` y `/alerta gdelt ARMEDCONFLICT` entran
  en el mismo run; si su fuente falla, sale en `failures` y esas alertas no
  disparan ni se borran.
- **La entrega si Telegram rechaza.** `delivered` lo diría, y el aviso quedaría
  guardado.

## 7 · Si algo sale mal

| Lo que ves | Qué significa |
|---|---|
| `200 {reason:"sin-redis"}` | Las variables no están en el despliegue que sirve. La sonda lo marca como fallo. |
| `failures: ["sin-precios"]` | CoinGecko no contestó: nada se dispara ni se borra; se reintenta en la siguiente pasada. |
| `401` con el secreto correcto | El `CRON_SECRET` que usas y el del despliegue no son el mismo. |
| `1 avisos · 0 disparados` con `BTC > 1` | El precio no llegó (mira `failures`), o la alerta se creó en otro despliegue con otro prefijo de claves. |
