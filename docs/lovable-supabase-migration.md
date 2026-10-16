# Salir de Lovable (Supabase) sin romper el login

No existe un mecanismo seguro para extraer el valor de un secreto ya guardado en Lovable
Cloud o Supabase. Los valores deben rotarse en el proveedor original y configurarse de nuevo
en el destino. No pegues claves en GitHub ni en el chat.

## Situación actual (medida 2026-10-16)

- Proyecto Supabase: `wkdtvrxavkhbifjtvvdw` (ya es del propietario). Las funciones Edge están
  versionadas en `supabase/functions/` y el frontend las invoca con
  `supabase.functions.invoke(...)` a través de `src/integrations/supabase/client.ts`.
- El **login social sigue siendo de Lovable**: `src/hooks/useAuth.ts` llama a
  `lovable.auth.signInWithOAuth(...)` de `src/integrations/lovable/index.ts`, que envuelve
  `@lovable.dev/cloud-auth-js`. En el bundle desplegado aparece `oauth.lovable.app`.
  Email/contraseña y wallet **ya son nativos de Supabase** y no dependen de Lovable.
- Enlaces de dominio ya corregidos en este cambio: `aitor.lovable.app` ya **no** aparece en
  el bundle (canonical/og de `Index`/`Auth`, `scripts/generate-sitemap.ts`, `robots.txt`,
  `sitemap.xml`).

## Inventario de la superficie Lovable

| Artefacto | Qué es | Se puede quitar ahora |
| --- | --- | --- |
| `@lovable.dev/cloud-auth-js` + `src/integrations/lovable/index.ts` + uso en `useAuth.ts` | Login OAuth Google/Apple | **No** — requiere probar el login nativo primero |
| `@lovable.dev/mcp-js` + `src/lib/mcp/*` + `mcpPlugin()` en `vite.config.ts` + `supabase/functions/mcp/` | Servidor MCP y herramientas | Después del login; quita features |
| `lovable-tagger` en `vite.config.ts` (solo `dev`) | Tags de componentes en desarrollo | Sí, es solo dev, pero va en el orden 4 |
| `.lovable/` | Config del editor | Orden 4 |
| `src/integrations/supabase/previewAuthStorage.ts` | Broker de sesión para previews de Lovable; en `aitor.alienflow.space` ya cae a `localStorage` | Orden 4 (toca el almacenamiento de sesión) |
| `src/lib/ai-models.ts` (`provider: "Lovable AI"`) | Etiqueta del proveedor de modelos | Coordinar con el enrutado de modelos del backend |
| `supabase/functions/_shared/guard.ts` | Allowlist de `Origin` con `aitor.lovable.app`, `.lovable.app`, `.lovableproject.com` | Tras el paso 3 (si ya no hay previews de Lovable) |

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
3. **Solo entonces** quitar `oauth.lovable.app`: borrar el uso de `lovable.auth.*` en
   `useAuth.ts`, eliminar `src/integrations/lovable/` y la dependencia
   `@lovable.dev/cloud-auth-js`.
4. **Después**: quitar `@lovable.dev/mcp-js` (+ `mcpPlugin()` de `vite.config.ts`,
   `src/lib/mcp/*`, `supabase/functions/mcp/`), `lovable-tagger` de `vite.config.ts` y del
   `devDependencies`, `.lovable/`, `src/integrations/supabase/previewAuthStorage.ts` y las
   entradas `*.lovable.app` de `_shared/guard.ts`.
5. Actualizar `src/lib/ai-models.ts` (etiquetas `Lovable AI`) y esta tabla.

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
