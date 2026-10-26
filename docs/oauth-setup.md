# Activar los proveedores de acceso (OAuth)

Los botones de la página de acceso existen todos, pero solo funcionan los
métodos que estén configurados en el proyecto de Supabase
(`wkdtvrxavkhbifjtvvdw`). Este documento es la lista de trabajo, con la consola
donde se crea cada aplicación y el callback exacto que hay que registrar.

> **Comprobado el 2026-10-20** con `npm run auth:providers` contra el proyecto
> real: `google` y `apple` aparecen **encendidos pero sin Client ID/Secret**
> (Supabase responde `Unsupported provider: missing OAuth secret`), los otros
> 17 están apagados, `email` funciona y `phone` está encendido **sin proveedor
> SMS** (por eso el envío de códigos por SMS falla).
>
> La página de acceso ya no deja pulsar esos botones: marca **sin configurar**
> (encendido, sin credenciales) o **no activado**, leyendo `/auth/v1/settings` y
> probando `/auth/v1/authorize` de cada proveedor activo.

> **Guía detallada de Google**, con el mapa de campos y los errores típicos:
> [oauth-google.md](oauth-google.md).

## Por qué antes solo funcionaban Google y Apple

Porque no los servía este proyecto: hasta el commit `Integrable Lovable OAuth` el
botón llamaba a `lovable.auth.signInWithOAuth("google" | "apple")`, es decir al
broker de Lovable (`oauth.lovable.app`) con **las credenciales de Lovable**, y ese
broker solo acepta `aitor.lovable.app` como `redirect_uri` y solo ofrece esos dos
proveedores. Al pasar a dominio propio y a hablar directo con Supabase, nadie
copió el Client ID y el secret: de ahí el `missing OAuth secret`. El detalle
está en [oauth-google.md](oauth-google.md#pero-si-google-y-apple-me-funcionaban-antes).

La consecuencia práctica: **ningún proveedor social está «roto»**, todos están
sin credenciales en el mismo sitio, y se arreglan uno a uno por el mismo camino.

## Ruta mínima: de cero a dos botones funcionando hoy

| Orden | Proveedor | Tiempo | Qué lo bloquea |
| --- | --- | --- | --- |
| 1 | **Google** | 10–15 min | nada: [guía paso a paso](oauth-google.md) |
| 2 | **GitHub** | 5 min | nada: OAuth App y dos valores |
| 3 | **Discord** | 5 min | nada |
| 4 | **Microsoft** | 15 min | cuenta Azure (gratuita) con permiso para registrar apps |
| 5 | **Twitch / GitLab / Spotify / Bitbucket** | 10 min cada uno | nada, pero aportan menos usuarios |
| 6 | **X, Facebook, LinkedIn, Slack** | 30–60 min | revisión o plan de API del proveedor |
| 7 | **Notion, Figma, Zoom, Kakao** | 30 min | revisión de la app en su marketplace |
| 8 | **Apple** | 1 h + 99 USD/año | cuenta de desarrollador; el secret es un JWT que caduca a los 6 meses |
| 9 | **Reddit, WeChat** | variable | no son nativos: van como *Custom Providers* (el plan gratuito permite 3) y WeChat exige cuenta de empresa china |

Cada fila se resuelve igual: crear la app en la consola del proveedor, registrar
la callback de arriba, pegar Client ID + Secret en Supabase y pulsar **revisar**
en la página de acceso (o `npm run auth:providers`) para confirmar el `✅`.

> El panel **System → Acceso e identidad → Proveedores sociales** muestra esta
> misma información dentro de la aplicación: estado medido de cada proveedor,
> consola, ruta del panel y la callback para copiar.

## Lo que se configura una sola vez en Supabase

1. **Authentication → URL Configuration**
   - `Site URL`: `https://aitor.alienflow.space`
   - `Redirect URLs`: `https://aitor.alienflow.space/**` y
     `http://localhost:8080/**`
   Sin esto, el proveedor devuelve al usuario y Supabase rechaza el `redirect_to`
   que manda la app (que es `window.location.origin`).
2. Para cada proveedor, **Authentication → Providers → (proveedor)**: activar el
   interruptor y pegar **Client ID** y **Client Secret**.
3. En la consola de cada proveedor hay que registrar **siempre la misma** URL de
   callback:

   ```
   https://wkdtvrxavkhbifjtvvdw.supabase.co/auth/v1/callback
   ```

## Proveedores: dónde se crea cada aplicación

| Botón | Id en el código | Consola | Notas |
| --- | --- | --- | --- |
| Google | `google` | <https://console.cloud.google.com/apis/credentials> | Crear *OAuth client ID* de tipo **Web**. Añadir la URL de callback en *Authorized redirect URIs*. |
| Apple | `apple` | <https://developer.apple.com/account/resources/identifiers> | Requiere cuenta de pago de Apple Developer: *Services ID* + *Key* `.p8` + Team ID + Key ID. Es el más laborioso. |
| Microsoft | `azure` | <https://portal.azure.com> → Entra ID → App registrations | Plataforma **Web**; el callback va en *Redirect URIs*. |
| GitHub | `github` | <https://github.com/settings/developers> → *New OAuth App* | *Authorization callback URL* = el callback de arriba. |
| X | `x` | <https://developer.x.com> | Usar el flujo **OAuth 2.0** (el id `twitter`, OAuth 1.0a, es el heredado). Callback también en la app. |
| Discord | `discord` | <https://discord.com/developers/applications> → OAuth2 | Añadir el callback en *Redirects*. |
| Facebook | `facebook` | <https://developers.facebook.com/apps> → *Facebook Login* → Settings | La app debe estar en modo *Live* para usuarios fuera de la app. |
| LinkedIn | `linkedin_oidc` | <https://www.linkedin.com/developers/apps> → pestaña *Auth* | Proveedor OIDC (el antiguo `linkedin` está retirado). |
| Reddit | `custom:reddit` | <https://www.reddit.com/prefs/apps> → *web app* | **Custom provider** (ver abajo), no es nativo de Supabase. |
| Twitch | `twitch` | <https://dev.twitch.tv/console/apps> | *OAuth Redirect URLs* = callback. |
| GitLab | `gitlab` | <https://gitlab.com/-/profile/applications> | Scopes: `read_user`. *Redirect URI* = callback. |
| Bitbucket | `bitbucket` | <https://bitbucket.org/account/settings/oauth-consumers/new> | Permisos: `Account: Read`, `Email: Read`. |
| Slack | `slack_oidc` | <https://api.slack.com/apps> → *OAuth & Permissions* | Proveedor OIDC. Callback en *Redirect URLs*. |
| Spotify | `spotify` | <https://developer.spotify.com/dashboard> | *Redirect URIs* = callback. |
| Notion | `notion` | <https://www.notion.so/my-integrations> | Integración **pública** con OAuth; *Redirect URI* = callback. |
| Figma | `figma` | <https://www.figma.com/developers/apps> | *Redirect URL* = callback. |
| Zoom | `zoom` | <https://marketplace.zoom.us> → *Build App* → OAuth | *OAuth Redirect URL* = callback. |
| Kakao | `kakao` | <https://developers.kakao.com/console/app> → *Kakao Login* | *Redirect URI* = callback. Activar además *OpenID Connect* si se pide. |

## Apple, paso a paso

Google tiene su guía completa en [oauth-google.md](oauth-google.md). Apple es el
caso raro: **su «secret» no es una contraseña, es un JWT firmado que caduca**.
Y para crearlo hace falta una cuenta de Apple Developer de pago.

1. **Identificador de app** (`Certificates, Identifiers & Profiles → Identifiers`):
   crea un *App ID* si no existe y marca la capability **Sign in with Apple**.
2. **Services ID** (`Identifiers → + → Services IDs`): es el identificador web,
   p. ej. `space.alienflow.aitor.web`. Activa **Sign in with Apple** →
   *Configure*:
   - **Primary App ID**: el del paso 1.
   - **Domains and Subdomains**: `wkdtvrxavkhbifjtvvdw.supabase.co` (sin
     `https://`). Apple no admite `localhost`: el flujo local devuelve al dominio
     real.
   - **Return URLs**: `https://wkdtvrxavkhbifjtvvdw.supabase.co/auth/v1/callback`
3. **Key** (`Keys → + → Sign in with Apple`): descarga `AuthKey_XXXXXXXXXX.p8`
   (solo se puede descargar una vez) y anota el **Key ID** y el **Team ID**
   (arriba a la derecha en la cuenta de desarrollador).
4. **Generar el secret** con la clave `.p8` (el JWT se firma en local; la clave
   no sale de tu máquina):

   ```bash
   npm run auth:apple-secret -- \
     --team-id ABCD1234E5 --key-id XYZ9876543 \
     --services-id space.alienflow.aitor.web \
     --key ~/AuthKey_XYZ9876543.p8
   ```

   Imprime el JWT por stdout e indica la fecha de caducidad. Ese valor va en
   **Authentication → Providers → Apple → Secret Key (for OAuth)**, junto al
   Services ID como *Client ID*.
5. **Verificar**: `npm run auth:providers` → `apple` debe pasar de
   `⚠️ faltan credenciales` a `✅ listo`.
6. **Renovar**: Apple no acepta un secret de más de 6 meses
   (15 777 000 s) y el script lo acota a 180 días. Caducado, el proveedor vuelve
   a responder `missing OAuth secret`. Guarda la fecha que imprime el comando y
   vuelve a generarlo antes: el `.p8` sirve para siempre, el JWT no.

| Mensaje en la pantalla de Apple | Causa |
| --- | --- |
| `invalid_client` | Services ID, Team ID o Key ID no coinciden, o el JWT caducó |
| `invalid_request` / `invalid_redirect_uri` | la *Return URL* no está registrada en el Services ID |
| `missing OAuth secret` (Supabase, antes de salir) | el campo *Secret Key* está vacío o el JWT ya expiró |

## Los dos proveedores personalizados

Supabase no los trae; se dan de alta en **Authentication → Providers → Custom
Providers** (el plan gratuito admite 3).

- **Reddit** → `custom:reddit`. Configuración manual OAuth2:
  - Authorization URL: `https://www.reddit.com/api/v1/authorize`
  - Token URL: `https://www.reddit.com/api/v1/access_token`
  - UserInfo URL: `https://oauth.reddit.com/api/v1/me`
  - Client ID/Secret de la app creada en <https://www.reddit.com/prefs/apps>
    (tipo *web app*, con el callback de Supabase).
- **WeChat** → `custom:wechat`. Necesita una app de **微信开放平台** (*sitio web*)
  con AppID y AppSecret. WeChat no habla OIDC (intercambia un `code` en
  `api.weixin.qq.com/sns/oauth2/access_token` y su *userinfo* recibe el token
  por query string), así que lo probable es que la configuración manual de
  Supabase no baste y haga falta un adaptador (una Edge Function o un broker
  OIDC delante). Probar primero la configuración manual y, si falla, ese
  adaptador es el siguiente paso.

## Teléfono (SMS)

`phone` ya está activado, pero Supabase solo enruta los SMS si hay un proveedor
conectado en **Authentication → Phone**: Twilio, Twilio Verify, MessageBird,
Vonage o TextLocal (comunidad). Hasta entonces el botón responde con el aviso
que ya muestra la app.

## Comprobar el estado en cualquier momento

```bash
npm run auth:providers
```

El script (`scripts/check-auth-providers.mjs`) lee los dos endpoints públicos
del proyecto — `/auth/v1/settings` y `/auth/v1/authorize` — y lista cada método
como **listo**, **faltan credenciales**, **apagado** o **error**, con el panel
donde se arregla. Termina con código 1 mientras quede alguno pendiente: es el
informe completo, no el guardián.

```bash
npm run auth:providers:gate
```

El guardián que corre en CI (`.github/workflows/ci.yml`, job `auth-providers`)
usa la misma medición y una regla más estrecha: **un proveedor encendido sin
credenciales es un fallo**, porque la página ofrece un botón que el servidor
rechaza con `400 Unsupported provider: missing OAuth secret` — así se rompió
Google y Apple al retirar el broker de Lovable, y nadie lo vio. Un proveedor
nunca activado es una decisión, no un fallo, así que no pinta el repositorio de
rojo por los 17 que aún no están.

Para que el guardián pueda ser bloqueante hoy sin tapar el problema, las
excepciones conocidas viven en `scripts/auth-providers.baseline.json` con fecha
de caducidad. Hoy contiene `google` y `apple`, que **vence el 2026-11-19**: a
partir de ese día CI falla hasta que se guarden las credenciales o se decida
extender la fecha de forma explícita. Cuando un proveedor empieza a responder,
el guardián avisa de que su entrada sobra — bórrala para que vuelva a estar
vigilado.

Un fallo de red no cuenta como misconfiguración: si Supabase no es accesible,
el guardián lo dice y pasa. Una clave rechazada o una URL mal escrita sí fallan.

## Lo que no se puede configurar desde el repositorio

Los Client ID y Secret se generan en la consola de cada proveedor y se guardan
en el panel de Supabase: no viven en el código ni en variables `VITE_*`
(esas acaban en el bundle del navegador). Por eso este trabajo se hace en el
panel, una vez por proveedor, usando la tabla de arriba.

## Recordatorio sobre email

El correo (contraseña, enlace mágico y código de 6 dígitos) ya funciona. Si
algún día se cambia el SMTP por defecto de Supabase, la ruta es
**Authentication → Emails (SMTP Settings)**.
