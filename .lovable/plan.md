

## Plan: Reconstruccion del Dashboard Tactico GLOBE — Ejecucion Paso a Paso

Basado en la imagen de referencia (Gemini_G-4.png) y el codigo actual.

---

### FASE 1: El Chasis UI (Glassmorphism y Paneles)

**Paso 1.1 — Crear TacticalConsole.tsx**
Nuevo componente con dos secciones colapsables:
- "GLOBAL TENSION" con Kp value grande y alerta TESLA CONVERGENCE
- "NOAA SPACE WEATHER" con Realtime Indices (R/S/G scales), Reactive Indices, y mini-grafico Kp procedural (SVG sparkline)

Consume `useSpaceWeather()` directamente.

Archivo: `src/components/dashboard/TacticalConsole.tsx` (crear)

**Paso 1.2 — Crear LegendPanel.tsx**
Panel "LEGEND & LAYERS" con las 7 categorias completas en grid 2-col con dots de color y toggle:

| Categoria | Color | Emoji |
|-----------|-------|-------|
| Finance/Tech | #FFD700 | 💰 |
| Intel/UAP | #00FF41 | 🛸 |
| Conflict | #FF4444 | 💥 |
| Geopolitical | #0088FF | 🏛️ |
| Logistics | #FF8844 | 📦 |
| Cryptozoology | #FF00FF | 🦎 |
| Convergence | #FFFFFF | ✨ |

Archivo: `src/components/dashboard/LegendPanel.tsx` (crear)

**Paso 1.3 — Crear NavigatePanel.tsx**
Panel "NAVIGATE" con iconos de banderas/regiones y lista de categorias con status dots verdes. Botones regionales que llaman `globeRef.pointOfView()` (se pasa callback como prop).

Archivo: `src/components/dashboard/NavigatePanel.tsx` (crear)

**Paso 1.4 — Crear MarketsTerminalMini.tsx**
Panel flotante "MARKETS TERMINAL" con tabs Dashboard/Glint.trade. Tabla con pares (GVD GSY, USD USDT, USD DSTK, NEP USDY) con sparkline mini, precio y cambio%. Usa datos de `useCryptoPrices`.

Archivo: `src/components/dashboard/MarketsTerminalMini.tsx` (crear)

**Paso 1.5 — Crear ChatFeedPanel.tsx**
Panel derecho con tabs FEED/MARKETS/FLIGHTS + filtros (Markets, High, Low, Category, Country). Lista de posts con avatar, username, badges, texto y "Add a comment..." input. Incluye label "OZONE LAYER: [ONLINE]".

Archivo: `src/components/dashboard/ChatFeedPanel.tsx` (crear)

**Paso 1.6 — Crear OsintTickerBar.tsx**
Barra inferior "OSINT FEED & TICKER" con:
- Icono expand a la izquierda
- Headlines con prefijo [ALERT] y source/time a la derecha
- "OZONE LAYER: [ONLINE]" badge verde a la derecha
- Scroll continuo tipo marquee

Archivo: `src/components/dashboard/OsintTickerBar.tsx` (crear)

**Paso 1.7 — Reescribir GlobeDashboard.tsx**
Layout principal con el globo `absolute inset-0` y paneles flotantes posicionados:

```text
+--[Crypto Ticker]--[LIVE ticker]---------------+
|                                                |
| [TacticalConsole]     [TENSION badge]  [Chat   |
| [NOAAPanel]                            Feed    |
|              GLOBE 3D                  Panel]  |
| [LegendPanel]                                  |
| [NavigatePanel]    [MarketsTerminalMini]        |
|                                                |
+--[OsintTickerBar]----[OZONE: ONLINE]-----------+
+--[TACTICAL · OSINT]---[NASA✓ USGS✓ NOAA✓]-----+
```

Elimina los paneles inline actuales (Tension/Layers simples) y los reemplaza por los nuevos componentes. Mantiene GlobeScene, GlobeOverlay, crypto ticker superior y LiveTicker sin cambios.

Archivo: `src/components/dashboard/GlobeDashboard.tsx` (reescribir)

---

### FASE 2: Motor 3D y Entorno Espacial

**Paso 2.1 — Anadir night lights (terminador dia/noche)**
Agregar prop `nightImageUrl` al componente Globe para mostrar city lights en la cara oscura:
```
nightImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
```
Esto es nativo de react-globe.gl y crea el efecto terminator automaticamente.

**Paso 2.2 — Mejorar atmosfera Tesla**
- Cuando Kp > 6: `atmosphereAltitude = 0.45`, anadir anillos ecuatoriales extra
- Gradiente mas intenso magenta/cyan en anillos polares para Kp > 5

**Paso 2.3 — Anadir nodo Convergence Zaragoza**
Punto blanco (#FFFFFF) en lat:41.65, lon:-0.88 tipo "dao_node" con arcos blancos conectando a nodos principales.

Archivos: `src/components/globe/GlobeScene.tsx` (modificar)

---

### FASE 3: Ingesta de Datos

**Paso 3.1 — Crear useRealTimeData.ts**
Hook orquestador que combina todos los hooks y expone:
- `mapLayers`: puntos para el globo separados por tipo
- `eventMarkers`: marcadores categorizados por las 7 categorias de la leyenda
- `tickerItems`: items formateados para el OSINT ticker
- `stats`: contadores por categoria para los badges de la leyenda

Consume: `useEarthquakes`, `useNasaEvents`, `useCryptoPrices`, `useSpaceWeather`, `useUAPSightings`

Archivo: `src/hooks/useRealTimeData.ts` (crear)

**Paso 3.2 — Conectar datos reales a los paneles**
- LegendPanel muestra contadores reales por categoria
- OsintTickerBar consume tickerItems reales
- MarketsTerminalMini muestra pares con precios reales
- ChatFeedPanel consume feed de earthquakes + NASA events

Archivos: Todos los componentes de Fase 1 (actualizacion menor)

---

### Orden de ejecucion recomendado

1. Paso 1.1 (TacticalConsole) + 1.2 (LegendPanel) — paneles izquierdos
2. Paso 1.3 (NavigatePanel) + 1.4 (MarketsTerminalMini) — paneles inferiores
3. Paso 1.5 (ChatFeedPanel) + 1.6 (OsintTickerBar) — panel derecho + barra inferior
4. Paso 1.7 (GlobeDashboard rewrite) — ensamblaje final
5. Paso 2.1-2.3 (Motor 3D) — mejoras visuales
6. Paso 3.1-3.2 (Datos) — conexion de APIs reales

### Archivos totales

| Archivo | Accion |
|---------|--------|
| `src/components/dashboard/TacticalConsole.tsx` | Crear |
| `src/components/dashboard/LegendPanel.tsx` | Crear |
| `src/components/dashboard/NavigatePanel.tsx` | Crear |
| `src/components/dashboard/MarketsTerminalMini.tsx` | Crear |
| `src/components/dashboard/ChatFeedPanel.tsx` | Crear |
| `src/components/dashboard/OsintTickerBar.tsx` | Crear |
| `src/components/dashboard/GlobeDashboard.tsx` | Reescribir |
| `src/components/globe/GlobeScene.tsx` | Modificar |
| `src/hooks/useRealTimeData.ts` | Crear |

No se tocan: `client.ts`, `types.ts`, `.env`, ResizeObserver, estructura base de GlobeScene.

