

## Plan: OSINT HUB Táctico con Datos en Tiempo Real

### Problema Crítico Detectado
Las llamadas a edge functions fallan constantemente (network requests muestran `avuflwehgtcstrejqdyh.supabase.co` con "Failed to fetch"). La URL del backend no coincide con el proyecto actual. Esto rompe NOAA, chat y todas las funciones backend. **Debe resolverse primero.**

### Enfoque: 3 Fases en una sola implementación

Dado el volumen, priorizamos APIs públicas CORS-friendly que pueden llamarse directamente desde el frontend (sin edge functions), resolviendo así el problema de backend roto.

---

### Fase A: APIs Públicas Directas (sin edge function, sin CORS issues)

Crear hooks React que hagan fetch directo a APIs públicas gratuitas:

| Hook | API | Datos |
|------|-----|-------|
| `useEarthquakes` | USGS `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | Sismos últimas 24h con lat/lon/magnitud |
| `useNasaEvents` | NASA EONET `eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20` | Incendios, tormentas, volcanes activos |
| `useCryptoPrices` | CoinGecko público `api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,...&vs_currencies=usd&include_24hr_change=true` | Precios BTC, ETH, BNB, SOL, TON, ATOM, POL |
| `useSpaceWeather` | **Refactorizar**: fetch directo a NOAA JSON (sin edge function) ya que son APIs públicas CORS-friendly |

Todas estas APIs son públicas, no requieren API key, y permiten CORS. Se implementa fallback a datos estáticos si el fetch falla.

---

### Fase B: Visualización en CesiumGlobe

Modificar `CesiumGlobe.tsx` para renderizar datos reales:

1. **Sismos (USGS)**: Anillos rojos expansivos. Tamaño proporcional a magnitud. Animación de pulso.
2. **Eventos NASA EONET**: Iconos amarillos para incendios/tormentas activas.
3. **Atmósfera mejorada**: Halo volumétrico con gradiente cyan-azul en el borde del globo usando una entidad `Ellipsoid` translúcida más grande que la Tierra.
4. **Tesla Aurora mejorada**: El shader/aura existente (Kp > 4) se mejora con gradiente cyan-verde-púrpura en los polos, no un elipsoide uniforme.

**No** reemplazamos Cesium por Three.js/React Globe — Cesium ya tiene texturas satelitales reales, night lights, y es mucho más potente. El skybox espacial de Cesium se configura con `SkyBox` o fondo negro puro (que ya tenemos con las estrellas implícitas).

---

### Fase C: Paneles de Interfaz

**1. Panel Izquierdo (Leyenda Táctica)**
- Refactorizar `GlobeDashboard.tsx`: leyenda compacta glassmorphism con contadores en tiempo real
- "Sismos 24h: {count}" / "Eventos NASA: {count}" / "Kp Index: {value}"
- 7 categorías con colores y emojis existentes

**2. Panel Superior (Crypto Ticker)**
- Nuevo widget en `GlobeDashboard.tsx` o `LiveTicker.tsx`: precios reales de BTC/ETH/BNB/SOL/TON/ATOM/POL con cambio 24h
- Botones minimalistas "Trade" como `<a href>` para futuras URLs de afiliación (Polymarket/exchanges)

**3. Live Ticker**
- Reemplazar datos estáticos de `BASE_TICKER` con titulares de sismos reales y eventos NASA
- Mantener alertas NOAA existentes
- Los datos de crypto prices se inyectan como items del ticker

**4. FeedPanel**
- Se mantiene estructura actual pero recibe datos reales de USGS/NASA como items del feed

---

### Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/hooks/useEarthquakes.ts` | **Crear** — fetch USGS GeoJSON |
| `src/hooks/useNasaEvents.ts` | **Crear** — fetch NASA EONET |
| `src/hooks/useCryptoPrices.ts` | **Crear** — fetch CoinGecko public API |
| `src/hooks/useSpaceWeather.ts` | **Refactorizar** — fetch directo a NOAA (sin edge function) |
| `src/components/globe/CesiumGlobe.tsx` | **Actualizar** — recibir sismos/eventos NASA como props, renderizar como entities, mejorar atmósfera |
| `src/components/dashboard/GlobeDashboard.tsx` | **Actualizar** — integrar hooks, pasar datos al globe, leyenda con contadores reales, crypto ticker |
| `src/components/dashboard/LiveTicker.tsx` | **Actualizar** — inyectar datos reales de sismos/crypto/NASA |
| `src/components/dashboard/FeedPanel.tsx` | **Actualizar** — mostrar eventos reales de USGS/NASA |
| `src/components/dashboard/GlobeOverlay.tsx` | **Actualizar** — Global Tension dinámico basado en sismos + Kp + eventos |

### Notas técnicas
- **NOAA directo**: `services.swpc.noaa.gov` permite CORS, no necesita proxy edge function. Eliminamos dependencia del backend roto.
- **CoinGecko público**: Rate limit 10-30 req/min, suficiente para polling cada 60s.
- **USGS**: Sin rate limit práctico, polling cada 5 min.
- **Rendimiento**: Los entities de Cesium se limpian y recrean solo cuando cambian los datos (no cada frame). Se usa `requestAnimationFrame` implícito de Cesium.
- **Fallback**: Cada hook tiene datos estáticos de respaldo si el fetch falla, para que la UI nunca esté vacía.

