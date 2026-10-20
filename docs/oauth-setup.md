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
donde se arregla. Termina con código 1 mientras quede alguno pendiente, así que
sirve también para un futuro check de CI cuando estén todos.

## Lo que no se puede configurar desde el repositorio

Los Client ID y Secret se generan en la consola de cada proveedor y se guardan
en el panel de Supabase: no viven en el código ni en variables `VITE_*`
(esas acaban en el bundle del navegador). Por eso este trabajo se hace en el
panel, una vez por proveedor, usando la tabla de arriba.

## Recordatorio sobre email

El correo (contraseña, enlace mágico y código de 6 dígitos) ya funciona. Si
algún día se cambia el SMTP por defecto de Supabase, la ruta es
**Authentication → Emails (SMTP Settings)**.
