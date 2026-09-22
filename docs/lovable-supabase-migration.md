# Migrar secretos y Edge Functions fuera de Lovable Cloud

No existe un mecanismo seguro para extraer el valor de un secreto ya guardado en Lovable Cloud o Supabase. Los valores deben rotarse en el proveedor original y configurarse de nuevo en el destino. No pegues claves en GitHub ni en el chat.

## Lo que ya está en el repositorio

Las funciones Edge están versionadas en `supabase/functions/` y el proyecto apunta a `wkdtvrxavkhbifjtvvdw`. El frontend las invoca mediante `supabase.functions.invoke(...)`. La búsqueda de código usada para este diagnóstico está limitada a resultados parciales; consulta [todo el código relevante en GitHub](https://github.com/Alien69Flow/AiTor/search?q=supabase.functions.invoke&type=code).

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

## Reglas de secretos

- `VITE_SUPABASE_*` y la publishable/anon key pueden estar en el cliente; no son secretos administrativos.
- `SUPABASE_SERVICE_ROLE_KEY`, PATs de GitHub, claves sociales y claves de modelos solo en backend/Edge Function secrets.
- El backend no acepta `SUPABASE_SERVICE_ROLE_KEY` desde peticiones HTTP.
- No se implementará extracción de secretos desde Lovable: hay que rotarlos y volver a introducirlos.
