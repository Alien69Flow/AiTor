
Objetivo confirmado: primero recuperar producción, luego conectar la capa OSINT unificada al Globe sin romper `react-globe.gl`, `ResizeObserver` ni la atmósfera/controles actuales.

1. Lo que he verificado en el repo
- El error público encaja con el cliente generado de backend: `src/integrations/supabase/client.ts` depende de `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en build time.
- La pestaña OSINT ya existe y `SystemTab` carga `OsintConsole`, que usa `useOsintIntel` y la función `osint-aggregator`.
- `useUnifiedIntel` existe, pero `GlobeDashboard` sigue consumiendo `useRealTimeData`.
- El globo todavía hace fetch directo dentro de `GlobeScene.tsx` a USGS/OpenSky, así que hoy no hay una unificación real de marcadores.
- `ChatFeedPanel` y `OsintTickerBar` todavía consumen solo USGS/NASA, no Firecrawl.

2. FASE 1 — Reparación del pipeline de producción
Paso 1.1 — Sincronización de entorno publicado
- Validar que el frontend publicado reciba las variables restauradas del backend integrado.
- Forzar un publish limpio del frontend para regenerar el bundle con:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- No tocar `src/integrations/supabase/client.ts`, `.env` ni `types.ts`.

Paso 1.2 — Endurecer puntos secundarios que aún dependen de env directo
- Revisar y normalizar los accesos directos a `import.meta.env` que no pasan por el cliente integrado, para evitar futuras roturas en producción.
- Prioridad:
  - `src/hooks/useOsintFeed.ts`
  - `src/services/agentTools.ts`

Paso 1.3 — Verificación post-build
- Confirmar que `aitor.lovable.app` deja de lanzar `supabaseUrl is required`.
- Confirmar que la app monta `Index` y la pestaña `System > OSINT` abre sin pantalla negra.

Archivos implicados en esta fase
- `src/hooks/useOsintFeed.ts`
- `src/services/agentTools.ts`
- Publicación frontend limpia

3. FASE 2 — Verificación de OSINT en System
Paso 2.1 — Comprobar cadena completa
- `SystemTab` → `OsintConsole` → `useOsintIntel` → `osint-aggregator`
- Validar estados: loading, error, lastUpdate y render de eventos.

Paso 2.2 — Ajustes mínimos si falla la consola OSINT
- Revisar shape de respuesta del agregador y consistencia de categorías/severidad.
- Mantener la UI actual; solo corregir integración si hiciera falta.

Archivos implicados
- `src/components/dashboard/SystemTab.tsx`
- `src/components/dashboard/OsintConsole.tsx`
- `src/hooks/useOsintIntel.ts`
- `src/hooks/useUnifiedIntel.ts`
- `supabase/functions/osint-aggregator/index.ts`

4. FASE 3 — Migración del Globe al núcleo unificado
Paso 3.1 — Hacer que `GlobeDashboard` use `useUnifiedIntel`
- Sustituir `useRealTimeData()` por `useUnifiedIntel()`.
- Tomar desde ahí:
  - `cryptoPrices`
  - `spaceWeather`
  - `earthquakes`
  - `nasaEvents`
  - `osint`
  - `events`
  - `counts`

Paso 3.2 — Separar datos visuales del globo de la lógica de fetch interna
- Refactorizar `GlobeScene.tsx` para que reciba los marcadores/capas por props desde el dashboard.
- Eliminar fetches directos embebidos en `GlobeScene` para USGS/OpenSky en favor del flujo unificado.
- Mantener intactos:
  - controles de cámara
  - `onReady`
  - atmósfera Tesla
  - moon/sun lighting
  - `ResizeObserver`

Paso 3.3 — Definir contrato unificado de datos
- Extender `useUnifiedIntel` para exponer:
  - `mapLayers`
  - `eventMarkers`
  - `tickerItems`
  - `counts`
- Mantener `useRealTimeData` como base ambiental y usar `useOsintIntel` para la capa Firecrawl.

Archivos implicados
- `src/components/dashboard/GlobeDashboard.tsx`
- `src/components/globe/GlobeScene.tsx`
- `src/hooks/useUnifiedIntel.ts`
- `src/hooks/useRealTimeData.ts`

5. FASE 4 — Inyectar OSINT real en feed y ticker del Globe
Paso 4.1 — ChatFeedPanel
- Mezclar eventos Firecrawl con USGS/NASA/Crypto en el panel derecho.
- Ordenar por frescura/severidad.
- Mantener filtros y búsqueda.

Paso 4.2 — OsintTickerBar
- Alimentarlo con `tickerItems` unificados.
- Incluir headlines Firecrawl además de NOAA/NASA/USGS.

Paso 4.3 — Marcadores del globo
- Mapear eventos OSINT con coordenadas cuando existan.
- Si un evento no trae coordenadas, mantenerlo en feed/ticker pero no forzarlo como punto geográfico.

Archivos implicados
- `src/components/dashboard/ChatFeedPanel.tsx`
- `src/components/dashboard/OsintTickerBar.tsx`
- `src/components/globe/GlobeScene.tsx`
- `src/hooks/useUnifiedIntel.ts`

6. Orden exacto de ejecución recomendado
1. Reparar publicación frontend y regenerar build limpio
2. Verificar `System > OSINT`
3. Migrar `GlobeDashboard` a `useUnifiedIntel`
4. Refactorizar `GlobeScene` para recibir datos por props
5. Conectar OSINT al panel derecho y ticker inferior
6. Validación final en preview y URL pública

7. Criterios de aceptación
- `aitor.lovable.app` carga sin `supabaseUrl is required`
- `System > OSINT` muestra eventos reales
- `GlobeDashboard` usa `useUnifiedIntel`
- El globo recibe datos unificados sin perder interacción ni renderizado
- `ChatFeedPanel` y `OsintTickerBar` muestran Firecrawl + USGS/NASA/Crypto
- No se modifica `client.ts`, `types.ts` ni `.env`

8. Archivos que modificaré
- `src/hooks/useOsintFeed.ts`
- `src/services/agentTools.ts`
- `src/components/dashboard/SystemTab.tsx`
- `src/components/dashboard/OsintConsole.tsx`
- `src/hooks/useOsintIntel.ts`
- `src/hooks/useUnifiedIntel.ts`
- `src/hooks/useRealTimeData.ts`
- `src/components/dashboard/GlobeDashboard.tsx`
- `src/components/globe/GlobeScene.tsx`
- `src/components/dashboard/ChatFeedPanel.tsx`
- `src/components/dashboard/OsintTickerBar.tsx`
- `supabase/functions/osint-aggregator/index.ts`

Al aprobar este plan, la ejecución debe arrancar por la FASE 1 para recuperar la URL pública antes de tocar la migración completa del Globe.
