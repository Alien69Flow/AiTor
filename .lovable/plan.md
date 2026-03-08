

## Plan: Integrar CesiumJS con Tiles Satelitales Reales + Fixes Pendientes

### Paso 1: Guardar el Cesium Ion Token como secreto seguro
El token que compartiste se almacenará como `CESIUM_ION_TOKEN` en los secretos del backend. Se usará desde el frontend ya que Cesium Ion tokens son **publishable** (públicos, como Google Maps API keys) — se expondrán como variable de entorno `VITE_CESIUM_ION_TOKEN`.

### Paso 2: Default tab → Terminal
Cambiar `useState<TabId>("markets")` → `useState<TabId>("terminal")` en `Index.tsx`.

### Paso 3: Integrar CesiumJS en Markets tab
Reemplazar el globo Three.js actual por un globo CesiumJS con tiles satelitales reales.

**Dependencia**: `cesium` + `resium` (wrapper React para CesiumJS)

**Nuevo archivo**: `src/components/globe/CesiumGlobe.tsx`
- Viewer CesiumJS con Cesium Ion imagery (tiles satelitales reales)
- Hotspots como entidades CesiumJS (billboards/points) con los mismos datos de `HOTSPOT_DATA`
- Click en hotspot → mismo popup `GlobeOverlay` con datos de mercado + UAP
- Arcos de conexión entre ciudades como polylines

**Modificar**: `src/components/dashboard/GlobeDashboard.tsx`
- Lazy-load `CesiumGlobe` en vez de `GlobeScene`
- Mantener `GlobeOverlay` y `FeedPanel` sin cambios

### Paso 4: Mejorar navegación con indicadores de estado
**`TopNavBar.tsx`**: Añadir badges visuales:
- 🟢 (punto verde) = datos en vivo (Terminal, Feed, Movers, UFO, Markets)
- 🟡 (punto amarillo) = demo/mock (Portfolio, Alerts)
- ⚪ (punto gris) = status (Monitor)

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| Secreto `CESIUM_ION_TOKEN` | Guardar token del usuario |
| `src/pages/Index.tsx` | Default tab → "terminal" |
| `src/components/globe/CesiumGlobe.tsx` | **Nuevo** — Globo CesiumJS con tiles reales |
| `src/components/dashboard/GlobeDashboard.tsx` | Usar CesiumGlobe en vez de GlobeScene |
| `src/components/dashboard/TopNavBar.tsx` | Indicadores live/demo por pestaña |

### Nota técnica
- CesiumJS pesa ~30MB pero se carga lazy. El globo Three.js actual se mantiene como fallback.
- El token de Cesium Ion es público (como una API key de Google Maps), así que se puede usar desde el frontend directamente.
- Las dependencias nuevas serían `cesium@^1.124.0` y `resium@^1.18.0`.

