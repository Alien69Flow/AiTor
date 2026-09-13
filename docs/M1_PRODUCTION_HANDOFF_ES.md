# M1 — Entrega y activación en producción

Fecha de verificación: 22 de agosto de 2026.

Este documento separa el código incluido en la PR de las acciones que requieren acceso del propietario a Vercel, Supabase, Telegram y Reown. Ninguna semilla, clave privada, contraseña o token secreto debe añadirse al repositorio.

## Alcance incluido en la PR

- Integración del bot de Telegram con AiTor y la función de IA existente.
- Endpoint serverless `POST /api/telegram-webhook` para Vercel.
- Comandos básicos `/start`, `/app`, `/dao`, `/help` y `/manus`.
- Respuestas automáticas y envío de consultas a AiTor.
- Botón directo `web_app` para abrir la Mini App sin depender del short name inexistente `t.me/Alien69Bot/app`.
- Validación obligatoria del header `X-Telegram-Bot-Api-Secret-Token`.
- Integración inicial de Reown AppKit para Polygon, Ethereum, Base, Arbitrum y BNB Chain.
- Vinculación segura de wallet mediante challenge y firma, sin solicitar seed phrase ni clave privada.
- Estructura de entitlements para liberar el tier confirmado.
- Migraciones y Edge Functions de Supabase para `wallet-link` y `access-status`.
- Estabilización de las capas combinadas del globe incluida en la rama de trabajo.

## Estado público verificado

- `https://aitor.alienflow.space/` responde correctamente.
- `https://aitor.alienflow.space/api/telegram-webhook` está publicado y acepta únicamente `POST`.
- Proyecto Supabase identificado: `wkdtvrxavkhbifjtvvdw`.
- La Edge Function `chat` está publicada.
- Las funciones `wallet-link` y `access-status` todavía no están publicadas y devuelven `404` antes de aplicar esta entrega.
- Los deployments de GitHub son realizados por `vercel[bot]` en los entornos `Preview` y `Production`.
- El webhook público actual no rechaza un secret token inválido; después del deploy de esta PR debe responder `401`.

## Acciones del propietario después del merge

### 1. Vercel

Configurar en el proyecto de producción, usando el panel cifrado de Environment Variables:

```text
TELEGRAM_BOT_TOKEN=<token de BotFather>
TELEGRAM_WEBHOOK_SECRET=<secreto aleatorio fuerte>
TELEGRAM_MINI_APP_URL=https://aitor.alienflow.space
MANUS_API_KEY=<clave de Manus>
MANUS_WEBHOOK_SECRET=<secreto del callback de Manus>
```

Las variables públicas de Supabase ya tienen una configuración de respaldo en el proyecto. Se pueden sobrescribir por despliegue con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

Después de configurar las variables, realizar un nuevo deployment de producción.

### 2. Supabase

Vincular Supabase CLI al proyecto `wkdtvrxavkhbifjtvvdw` con una cuenta autorizada. Aplicar las migraciones nuevas:

```text
supabase/migrations/20260815143000_prepare_wallet_entitlements.sql
supabase/migrations/20260819170000_add_wallet_verification_challenges.sql
```

Publicar las funciones:

```text
supabase/functions/wallet-link
supabase/functions/access-status
```

Confirmar que las políticas RLS siguen activas y que un usuario solamente puede consultar o modificar sus propios datos.

### 3. Telegram

Después del deployment, volver a registrar el webhook utilizando el mismo valor definido como `TELEGRAM_WEBHOOK_SECRET` en Vercel:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://aitor.alienflow.space/api/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

No guardar el token ni el secreto en commits, issues, PRs o mensajes públicos.

### 4. Reown

- Autorizar `https://aitor.alienflow.space` en el proyecto Reown utilizado por AlienFlowSpace, o configurar un proyecto separado mediante `VITE_REOWN_PROJECT_ID`.
- Mantener Polygon como red principal inicial.
- Ethereum y las demás redes EVM quedan disponibles como expansión.
- Lightning Network requiere una integración separada y no forma parte del cierre técnico de M1.

### 5. Reglas de acceso NFT/paywall

Antes de activar accesos comerciales reales, confirmar y configurar públicamente:

- dirección exacta de cada contrato NFT;
- red y estándar del contrato;
- colección o token que concede cada tier;
- si el NFT solamente concede acceso o también se consume/canjea;
- duración del acceso;
- wallet de recepción, activo aceptado y precio cuando exista pago directo.

Hasta que estas reglas sean confirmadas, el sistema mantiene los entitlements en modo seguro y no inventa accesos ni cobros.

## Pruebas de aceptación

- `/start`, `/help`, `/dao` y `/app` responden en Telegram.
- `/app` abre `https://aitor.alienflow.space` dentro de Telegram.
- Una pregunta normal recibe respuesta de AiTor.
- Un POST sin secret token o con secret token inválido devuelve `401`.
- El login web funciona.
- La conexión Reown abre el selector de wallets.
- La firma vincula la wallet a la cuenta autenticada.
- `wallet-link` y `access-status` dejan de devolver `404`.
- Un entitlement activo libera únicamente el tier correspondiente.
- El build de producción y los endpoints serverless terminan sin errores.

## Fuera del alcance de cierre de M1

- Migración o pagos nativos mediante Lightning Network.
- Emisión de nuevos criptoactivos.
- Conversión fiat y liquidación multimoneda.
- Publicación automática en redes sociales y fases avanzadas de Agents, Loops y RAG.

