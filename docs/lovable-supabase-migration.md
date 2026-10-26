# Salir de Lovable (Supabase) sin romper el login

No existe un mecanismo seguro para extraer el valor de un secreto ya guardado en Lovable
Cloud o Supabase. Los valores deben rotarse en el proveedor original y configurarse de nuevo
en el destino. No pegues claves en GitHub ni en el chat.

## Situación actual (medida 2026-10-16)

- Proyecto Supabase: `wkdtvrxavkhbifjtvvdw` (ya es del propietario). Las funciones Edge están
  versionadas en `supabase/functions/` y el frontend las invoca con
  `supabase.functions.invoke(...)` a través de `src/integrations/supabase/client.ts`.
- El **login social ya no usa Lovable en el código**: `src/hooks/useAuth.ts` llama a
  `supabase.auth.signInWithOAuth(...)` para los 18 proveedores y `src/integrations/lovable/`
  (envoltorio de `@lovable.dev/cloud-auth-js`) se borró. En el **bundle desplegado** (17-10)
  todavía aparecen `oauth.lovable.app` y `~oauth/initiate`: eso es lo que el usuario ve en
  `aitor.alienflow.space` hasta que se redespliegue. Email/contraseña y wallet ya eran
  nativos de Supabase.
- Enlaces de dominio ya corregidos en este cambio: `aitor.lovable.app` ya **no** aparece en
  el bundle (canonical/og de `Index`/`Auth`, `scripts/generate-sitemap.ts`, `robots.txt`,
  `sitemap.xml`).

## Inventario de la superficie Lovable

| Artefacto | Qué es | Se puede quitar ahora |
| --- | --- | --- |
| `@lovable.dev/cloud-auth-js` + `src/integrations/lovable/index.ts` + uso en `useAuth.ts` | Login OAuth Google/Apple | ✅ **Hecho**: `useAuth` es 100 % Supabase, `src/integrations/lovable/` se borró y la dependencia ya no está en `package.json` ni en el lockfile |
| `@lovable.dev/mcp-js` + `src/lib/mcp/*` + `mcpPlugin()` en `vite.config.ts` + `supabase/functions/mcp/` | Servidor MCP y herramientas | ✅ **Hecho (2026-10-20)**: dependencia, plugin, fuentes y función retirados |
| `lovable-tagger` en `vite.config.ts` (solo `dev`) | Tags de componentes en desarrollo | ✅ **Hecho (2026-10-20)** |
| `.lovable/` | Config del editor y planes | ✅ **Hecho (2026-10-20)**: borrado; los planes pasan a `docs/plans/` |
| `src/integrations/supabase/previewAuthStorage.ts` | Broker de sesión para previews de Lovable; en `aitor.alienflow.space` ya cae a `localStorage` | ✅ **Hecho (2026-10-20)**: `client.ts` usa el almacenamiento por defecto |
| `src/lib/ai-models.ts` (`provider: "Lovable AI"`) | Etiqueta del proveedor de modelos | **Se queda**: nombra el gateway real (`ai.gateway.lovable.dev`) que sirve los modelos de Google/OpenAI con `LOVABLE_API_KEY` |
| `supabase/functions/_shared/guard.ts` | Allowlist de `Origin` con `aitor.lovable.app`, `.lovable.app`, `.lovableproject.com` | ✅ **Hecho (2026-10-20)**: solo dominios propios y local |

La ruta `/.lovable/oauth/consent` se mantiene a propósito: es la pantalla de
consentimiento OAuth de Supabase (`OAuthConsent`), no depende del SDK retirado y su URL
puede estar registrada en el panel de Auth. Cambiarla sin actualizar ese registro rompería
el consentimiento de cualquier cliente OAuth.

## Ruta segura de migración

1. En Lovable/Supabase identifica el proyecto actual y exporta solo el código de las funciones desde el repositorio.
2. Crea o selecciona el proyecto Supabase destino.
3. Ejecuta las migraciones y despliega las funciones desde una máquina autenticada:

```bash
supabase login
supabase link --project-ref DESTINO_PROJECT_REF
supabase db push
supabase functions deploy --no-verify-jwt
```

4. Revisa cada función antes de conservar `--no-verify-jwt`. Las funciones de datos privados, pagos, GitHub y escritura deben validar JWT en servidor. No uses `verify_jwt = false` como sustituto de autorización.
5. Rota cada proveedor en su consola original y guarda los nuevos valores como secretos del proyecto destino:

```bash
supabase secrets set GEMINI_API_KEY=... FIRECRAWL_API_KEY=... GITHUB_TOKEN=...
```

6. Cambia el backend a:

```bash
SUPABASE_URL=https://DESTINO_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# Solo en backend/worker de confianza; nunca en Vite ni en el navegador:
SUPABASE_SERVICE_ROLE_KEY=...
```

7. Prueba primero funciones de lectura (`crypto-feed`, `weather-grid`, `firecrawl-search`) con un usuario autenticado. Después habilita herramientas de escritura una por una con aprobación humana.

## Orden para salir del login de Lovable (sin romper nada)

> **Actualización (2026-10-19).** Se comprobó en vivo que el broker de Lovable rechaza el
> dominio propio: `GET https://oauth.lovable.app/initiate?...&redirect_uri=https://aitor.alienflow.space/`
> responde `400 redirect_uri is not allowed` (solo admite `aitor.lovable.app`), y
> `/~oauth/initiate` no existe fuera del hosting de Lovable (`404` en Vercel). Por eso el
> paso 1 ya está implementado y es el camino por defecto:
>
> - `useAuth.ts` usa `supabase.auth.signInWithOAuth` para Google y Apple, con un
>   *pre-flight* de `/authorize?skip_http_redirect=true` para que un proveedor sin
>   credenciales muestre un aviso en la app en vez de dejar al usuario en una página JSON.
> - El flujo de Lovable **ya no se puede restaurar desde el código**: la rama del broker se
>   retiró con `src/integrations/lovable/` y `vercel.json` redirige `/~oauth/initiate` a
>   `/auth`. Solo existiría sirviendo la app otra vez desde un dominio `*.lovable.app`, que es
>   donde el broker tiene sus propias credenciales de Google y Apple.
> - **Paso 2 pendiente, del propietario**: crear un cliente OAuth de Google (redirect
>   `https://wkdtvrxavkhbifjtvvdw.supabase.co/auth/v1/callback`) y guardarlo en Supabase →
>   Authentication → Providers → Google, más `https://aitor.alienflow.space/**` en Site URL /
>   Redirect URLs. Hasta entonces el botón Google muestra el aviso exacto.
>
> Verificado el 2026-10-19: `tsc -b`, `vite build` y el flujo en `localhost:8080/auth`
> (Google → aviso, email → «Credenciales incorrectas»).

## Inventario de métodos de acceso (2026-10-19)

La pantalla de acceso (`src/components/auth/AuthMethods.tsx`, usada en `/auth` y en el panel
DAO de `SystemTab`) ofrece **18 botones OAuth + Instagram (informativo) + wallet + email**,
todos por Supabase Auth. El build desplegado en `aitor.alienflow.space` es del 17-10 y
antecede a `AuthMethods`, por eso allí solo se ven 4 (búsqueda en el bundle: `linkedin_oidc`
= 0, `~oauth/initiate` = 1): al redesplegar desaparecen el 404 de `~oauth/initiate` y el
salto a `oauth.lovable.app`.

| Método | Id en GoTrue | Estado en código | Qué falta (consola del propietario) |
| --- | --- | --- | --- |
| Email + contraseña (entrar/crear) | — | ✅ funciona | nada |
| Wallet Reown (SIWE → `wallet-auth`) | — | ✅ abre el conector | nada |
| Google | `google` | código listo | Cliente OAuth de Google → Providers → Google (`missing OAuth secret` verificado por API el 19-10) |
| Apple | `apple` | código listo | Apple Developer (Services ID + secret) → Providers → Apple (igual: `missing OAuth secret`) |
| Microsoft | `azure` | código listo | app de Azure AD → Providers → Azure |
| GitHub | `github` | código listo | OAuth App de GitHub → Providers → GitHub |
| X | `x` | código listo | app OAuth 2.0 de X → Providers → X |
| Discord | `discord` | código listo | application de Discord → Providers → Discord |
| Facebook | `facebook` | código listo | app de Meta → Providers → Facebook |
| LinkedIn | `linkedin_oidc` | código listo | app de LinkedIn → Providers → LinkedIn |
| Reddit | `custom:reddit` | código listo | Custom Provider manual (ver receta abajo) |
| Twitch | `twitch` | código listo | app de Twitch → Providers → Twitch |
| GitLab | `gitlab` | código listo | app OAuth de GitLab → Providers → GitLab |
| Bitbucket | `bitbucket` | código listo | OAuth consumer de Bitbucket → Providers |
| Slack | `slack_oidc` | código listo | app de Slack (OIDC) → Providers → Slack |
| Spotify | `spotify` | código listo | app de Spotify → Providers → Spotify |
| Notion | `notion` | código listo | integration de Notion → Providers → Notion |
| Figma | `figma` | código listo | app de Figma → Providers → Figma |
| Zoom | `zoom` | código listo | app de Zoom (OAuth) → Providers → Zoom |
| Kakao | `kakao` | código listo | app de Kakao → Providers → Kakao |
| Instagram | — (no existe) | informativo | Meta no ofrece login con Instagram; usar Facebook |

> `keycloak`, `workos` y `fly` no se muestran a propósito: son IdP corporativos que
> necesitan una URL de realm propia y un botón siempre fallaría para usuarios reales.

### Receta Reddit (proveedor manual)

Reddit no es un proveedor integrado de Supabase; se registra como OAuth 2.0 manual en
Authentication → Providers → Custom Providers → New Provider:

| Campo | Valor |
| --- | --- |
| Identifier | `custom:reddit` |
| Authorization URL | `https://www.reddit.com/api/v1/authorize` |
| Token URL | `https://www.reddit.com/api/v1/access_token` |
| User Info URL | `https://oauth.reddit.com/api/v1/me` |
| Scope | `identity` |
| `email_optional` | `true` (Reddit no devuelve email con `identity`) |
| `pkce_enabled` | `false` (el flujo documentado de Reddit no admite PKCE) |

La URL de *callback* que muestra Supabase hay que registrarla en la app de Reddit
(redirect URI). Fuente: [Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers).

Requisitos comunes a todos los sociales: `Site URL = https://aitor.alienflow.space` y
`Redirect URLs = https://aitor.alienflow.space/**` (más `http://localhost:8080/**` para
desarrollo). Cada proveedor sin configurar muestra en la app: «… no está activado en Supabase
(Authentication → Providers)» o «Faltan las credenciales de … (Client ID + Secret)».

Pruebas del 2026-10-19 sobre `localhost:8080/auth`: los 18 botones OAuth muestran su aviso
**sin salir de `/auth`**, Instagram explica por qué no puede existir, el email responde
«Credenciales incorrectas» y la wallet abre el conector de Reown.

Sondeo directo de `/auth/v1/authorize` (19-10, con `redirect_to` de producción): Google y
Apple → `400 missing OAuth secret`; GitHub → `400 provider is not enabled`; Reddit
(`custom:reddit`) → `400` (aún sin registrar como Custom Provider). O sea: **ningún
proveedor está activado todavía en este proyecto Supabase**; hasta que el propietario cree
los clientes OAuth, todos — incluidos Google y Apple — mostrarán su aviso, que es el
comportamiento esperado del flujo nativo. En el build viejo desplegado Google/Apple
"funcionaban" porque los hacía el broker de Lovable, que en el dominio propio terminaba
en el 404 de `~oauth/initiate`.

El login social es el único bloqueante real del propietario de la cuenta, así que va primero.
Cada paso es reversible hasta el 4.

1. **Poner en pie el camino propio (Supabase) sin activarlo.** Añadir a `useAuth` una ruta
   nativa `supabase.auth.signInWithOAuth({ provider: "google" | "apple", options: { redirectTo } })`
   detrás de un flag (p. ej. `VITE_NATIVE_OAUTH=true`). Requiere habilitar los proveedores
   Google/Apple en el proyecto Supabase y añadir
   `https://aitor.alienflow.space/**` a las *Redirect URLs* permitidas.
2. **Probar login y sesión reales** con el flag activo: entrar, refrescar, cerrar sesión y
   comprobar que `supabase.auth.getSession()` persiste. Esto exige **navegador** y los
   proveedores configurados: *no verificable desde aquí*.
3. ~~**Solo entonces** quitar `oauth.lovable.app`: borrar el uso de `lovable.auth.*` en
   `useAuth.ts`, eliminar `src/integrations/lovable/` y la dependencia
   `@lovable.dev/cloud-auth-js`.~~ **Hecho en código (2026-10-19)**: el uso y el directorio
   ya no existen; falta quitar `@lovable.dev/cloud-auth-js` de `package.json` en el siguiente
   paso de limpieza.
4. ~~**Después**: quitar `@lovable.dev/mcp-js` (+ `mcpPlugin()` de `vite.config.ts`,
   `src/lib/mcp/*`, `supabase/functions/mcp/`), `lovable-tagger` de `vite.config.ts` y del
   `devDependencies`, `.lovable/`, `src/integrations/supabase/previewAuthStorage.ts` y las
   entradas `*.lovable.app` de `_shared/guard.ts`.~~ **Hecho el 2026-10-20.** El lockfile se
   regeneró con npm 10.9.4 y `npm ci --dry-run` lo acepta. La función `mcp` **sigue
   desplegada** (borrar la carpeta no la retira): para apagarla hace falta
   `npx supabase functions delete mcp --project-ref wkdtvrxavkhbifjtvvdw` con un token.
   El SDK de MCP tenía un advisory sin parche (`GHSA-6qxp-vccf-f47h`), así que apagarla
   cierra también ese aviso en el runtime.
5. Actualizar `src/lib/ai-models.ts` (etiquetas `Lovable AI`) y esta tabla. **Decisión
   (2026-10-20)**: las etiquetas se quedan, porque el gateway que responde de verdad es el
   de Lovable; cambiarlas por "OpenAI" haría que la UI mintiera sobre a quién se llama.

Los pasos 1–2 no se han ejecutado en este cambio: requieren un navegador y credenciales de
OAuth que no están disponibles en esta sesión. Por eso **no se ha borrado nada del login**:
borrarlo sin probarlo dejaría a los usuarios sin acceso social.

## Reglas de secretos

- `VITE_SUPABASE_*` y la publishable/anon key pueden estar en el cliente; no son secretos administrativos.
- `SUPABASE_SERVICE_ROLE_KEY`, PATs de GitHub, claves sociales y claves de modelos solo en backend/Edge Function secrets.
- El backend no acepta `SUPABASE_SERVICE_ROLE_KEY` desde peticiones HTTP.
- No se implementará extracción de secretos desde Lovable: hay que rotarlos y volver a introducirlos.
- Nunca uses el prefijo `VITE_` para una clave de modelo: se incrusta en el bundle (ver
  `docs/security-review.md`, sección 2).
