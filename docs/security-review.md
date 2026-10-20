# Revisión de seguridad — 2026-10-16

Alcance: endpoints públicos (`api/*`), historial de secretos en Git, y comprobación de
identidad en las Edge Functions que escriben datos. Todo lo de abajo se verificó leyendo el
código de este repositorio; lo que no se pudo verificar en vivo se marca como tal.

## 1. Endpoints públicos

### `api/telegram-webhook.ts` — **arreglado (era fail-open)**

Antes: si `TELEGRAM_WEBHOOK_SECRET` estaba configurado y el header
`x-telegram-bot-api-secret-token` **faltaba**, solo se registraba un `console.warn` y la
petición seguía adelante. Es decir, una petición **no firmada** podía entrar y consumir la
función `chat` de Supabase y la API de Manus (cuota de pago). Era el hallazgo más grave.

Ahora: **fail-closed**. Si `TELEGRAM_WEBHOOK_SECRET` no está definido se responde `401`; si
está definido y el header no coincide (comparación en tiempo constante con
`crypto.timingSafeEqual`) se responde `401`.

> **Acción requerida del propietario**: definir `TELEGRAM_WEBHOOK_SECRET` en Vercel y
> re-registrar el webhook con el mismo `secret_token`, o el bot dejará de responder:
>
> ```bash
> node scripts/telegram-webhook.mjs --set   # registra URL + secret y muestra getWebhookInfo
> ```
>
> Equivalente a mano:
>
> ```bash
> curl -F "url=https://<PUBLIC_URL>/api/telegram-webhook" \
>      -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
>      "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook"
> ```

Comprobado en vivo el 2026-10-19: `POST https://aitor.alienflow.space/api/telegram-webhook`
sin la cabecera devuelve `401 Unauthorized`, es decir el endpoint *está* desplegado en fail
closed. Si el bot no responde, la causa está en la configuración (secreto en Vercel y
`setWebhook`), no en el código. El comportamiento del handler está cubierto por pruebas
ejecutadas con `tsx` (401 sin secreto / con secreto incorrecto, 200 con secreto correcto,
500 si falta `TELEGRAM_BOT_TOKEN`, 405 a métodos que no sean POST).

### `api/manus-callback.ts` — correcto, endurecido

Ya exigía `MANUS_WEBHOOK_SECRET` (`401` si falta o no coincide). Se ha cambiado la
comparación a tiempo constante (`crypto.timingSafeEqual`). No requiere cambios de config.

## 2. Secreto versionado en el historial — **acción requerida**

`.env` estuvo **commiteado** en el historial (commits `2a88e26`, `3ddbc4e`, `7b65778`,
`cd30adc`, `edff06c`, entre 2026-03-19 y 2026-03-23). Los **nombres de clave** que contenía
(nunca se han impreso valores):

- `VITE_GEMINI_API_KEY` ← **API key real de Gemini. ROTAR YA.**
- `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PROJECT_ID` (públicas por diseño; van en el bundle, no son secretos
  administrativos, pero conviene saber que están en el historial).

Recomendaciones:

1. **Rotar `VITE_GEMINI_API_KEY`** en Google AI Studio y no volver a usar el prefijo `VITE_`
   para esa clave: `VITE_*` se incrusta en el bundle del navegador. La clave de un modelo
   debe vivir como secreto de la Edge Function (servidor), no en el cliente.
2. `.env` ya está en `.gitignore`. El historial no se ha reescrito (reescribir historia es
   destructivo y no se pidió); al rotar, el valor antiguo queda inútil.

Verificación del bundle actual (build local de este commit): `AIza`, `service_role`,
`OPENAI_API_KEY` y `TELEGRAM_BOT_TOKEN` → **0 coincidencias**. Las 22 coincidencias de `sk-`
son falsos positivos (`mask-image`, `lisk-sepolia`, `task-list`). La propiedad de "no
exponer secretos en el bundle" se mantiene.

## 3. Edge Functions que escriben datos — verifican identidad

| Función | Escritura | Identidad | Valoración |
| --- | --- | --- | --- |
| `verify-crypto-payment` | `user_credits` upsert, `crypto_payments` insert | `admin.auth.getUser(Bearer)`; usa `user.id` del token, **no** lo que manda el cliente | OK. Valida `txHash` con regex, resuelve la dirección de cobro en servidor, espera el recibo y comprueba el evento `Transfer` al receptor por el importe. Marca la tx como usada (`409` si ya existe) |
| `verify-dao-holdings` | `user_credits` upsert | `admin.auth.getUser(Bearer)` + firma EIP-191 de la wallet consultada | OK; `user.id` viene del token |
| `wallet-auth` | crea usuarios (service role) | firma EIP-191 verificada con `viem.verifyMessage` | OK; sin rate limit propio (abuso menor: creación de usuarios con firma propia) |
| `ufo-feed` | upsert de caché | cabecera `x-refresh-secret` (`secretMatches`) | OK para la ruta de refresco |
| `github-proxy` | — | `supabase.auth.getUser()` del cliente anon (RLS) | OK |
| proxies públicos (`weather-grid`, `air-traffic`, `marine-traffic`, `osint-aggregator`, `cesium-tiles`, `firecrawl-search`, `globe-feeds`, `openweather`, `web3-recipient`) | — | `guardPublic()`: allowlist de `Origin` + rate limit por IP en memoria | **Abuso contenido, no autenticación.** El `Origin` se puede falsificar desde un cliente no-navegador y el rate limit es por instancia (se reinicia). Adecuado solo porque estos feeds son públicos por diseño |

Detalle menor (no de seguridad) en `verify-crypto-payment`: responde `tier: "synapse"` pero
guarda `paid_tier: "basic"`. Conviene alinear la nomenclatura.

## 4. Workflows de GitHub ya existentes — **riesgo de cadena de suministro**

No forman parte del CI nuevo (`.github/workflows/ci.yml`), pero conviene señalarlos:

- ~~`.github/workflows/repoheart.yml`~~ — **eliminado**. Usaba `OpenAgentHQ/repoheart@main`
  (rama móvil, sin pin) con `contents: write`, `issues: write` y `pull-requests: write`, y
  fallaba en el 100 % de los eventos con un run de 0 s sin logs: su paso pide
  `config: repoheart.yml` y ese fichero no existe en la raíz. Si se vuelve a necesitar, que
  sea con la acción fijada a un SHA concreto y sin permiso de escritura de contenido.
- `.github/workflows/dissent.yml` (`itsarbit/dissent@v1`) y `pr-reviewer.yml`
  (`pip3 install agentic-pr-reviewer`) son acciones de terceros que consumen
  `secrets.OPENAI_API_KEY`. No tienen permisos de escritura de contenido, solo se ejecutan
  en pull requests y ambos fallan mientras esa secreto no exista. Revisar si siguen siendo
  deseados; si no, eliminarlos.

**Estado: la recomendación de este informe ya está aplicada.** `main` tiene protección de
rama con el required status check `typecheck · lint · build` (job `quality` de `ci.yml`),
`enforce_admins` activo y force-push deshabilitado, así que un push directo a `main` se
rechaza si el chequeo no pasa y los bots de revisión ya no son el único control. Para
relajarlo temporalmente:

```bash
gh api -X DELETE repos/Alien69Flow/AiTor/branches/main/protection
```

## 5. Abuso de los envíos de código — Turnstile

El registro y cada envío de OTP (email o SMS) cuestan dinero por unidad y cualquier
visitante puede dispararlos en bucle desde el formulario de acceso. Supabase verifica un
CAPTCHA en esas rutas cuando el proyecto lo tiene activo en **Settings → Captcha**, y el
cliente adjunta el token con `options.captchaToken`.

- `src/lib/turnstile.ts` carga el widget de Cloudflare una sola vez, lo deja fuera de pantalla
  y devuelve un token de un solo uso; cada llamada lo reinicia para el siguiente intento.
- Sin `VITE_TURNSTILE_SITEKEY` la función devuelve `null`, la llamada sale sin token y todo
  se comporta como antes: habilitar la protección es crear el widget en el panel de
  Cloudflare, poner la site key en VITE y la secret key en Supabase.
- Cubiertos: registro con clave, envío de enlace mágico, envío de código por email y por
  SMS, y passkey. No cubre el inicio de sesión con clave ya existente (no envía nada) ni el
  intercambio OAuth, que lo limita el proveedor.

Pendiente de verificación real: el token solo se puede comprobar de punta a punta con el
widget activo en el panel de Supabase; hasta entonces el camino sin token es el mismo de
siempre.
