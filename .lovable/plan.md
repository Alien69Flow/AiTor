

## Plan: Globo Interactivo + Pestañas con Contenido Real

### Estado Actual
- **Globo 3D**: Three.js con hotspots pero sin interactividad (no responde a clicks)
- **Pestañas vacías**: Feed, Movers, Portfolio, Alerts, Monitor → todas muestran "Coming Soon"
- **Pestañas activas**: Terminal, Markets, UFO/Alien, Solar System
- **Feed panel** (derecho en Markets): datos mock hardcodeados
- **CesiumJS**: No necesitas token para esta fase. El globo Three.js actual es suficiente; CesiumJS requiere un token de Cesium Ion (gratuito con cuenta) pero lo dejamos para una fase posterior

### Cambios Propuestos

#### 1. Globo 3D Interactivo — Click en Hotspots
**`src/components/globe/GlobeScene.tsx`**
- Implementar **raycasting** para detectar clicks en hotspots del globo
- Al hacer click en un hotspot → mostrar **popup HTML overlay** con:
  - Nombre del país/ciudad
  - Datos de mercado (mock realista: volumen, tendencia, top tokens)
  - Avistamientos UAP cercanos (fetch desde tabla `uap_sightings` por lat/lon)
  - Links a fuentes
- Usar estado React para pasar datos del hotspot clickeado al overlay
- Añadir datos de país a cada hotspot (nombre, mercado, tipo)

**`src/components/dashboard/GlobeOverlay.tsx`**
- Añadir componente `CountryPopup` que se muestra al clickear un hotspot
- Datos: nombre país, indicadores de mercado, últimos UAP reports de esa zona
- Botón para cerrar el popup

#### 2. Pestaña Feed — Real-Time News via Firecrawl
**`src/components/dashboard/FeedTab.tsx`** (nuevo)
- Usar Firecrawl search para traer noticias crypto/geopolíticas en tiempo real
- Queries: "crypto market news", "geopolitical events", "blockchain news"
- Feed con cards: source, título, snippet, timestamp
- Botón refresh para actualizar

#### 3. Pestaña Movers — Top Crypto Movers
**`src/components/dashboard/MoversTab.tsx`** (nuevo)
- Usar datos de CoinGecko API pública (gratuita, no necesita key)
- Tabla con: Top gainers, Top losers, Volume leaders
- Datos: nombre, precio, % cambio 24h, volumen
- Auto-refresh cada 60s

#### 4. Pestaña Portfolio — Wallet Tracker (mock + estructura)
**`src/components/dashboard/PortfolioTab.tsx`** (nuevo)
- Vista de portfolio con datos demo
- Gráfico de distribución (pie chart con Recharts)
- Lista de holdings con P&L
- CTA para conectar wallet real

#### 5. Pestaña Alerts — Alert Configuration
**`src/components/dashboard/AlertsTab.tsx`** (nuevo)
- Panel de alertas configurables
- Tipos: precio, volumen, UAP sighting, señal geopolítica
- Lista de alertas activas (mock)
- Formulario para crear nueva alerta

#### 6. Pestaña Monitor — System Dashboard
**`src/components/dashboard/MonitorTab.tsx`** (nuevo)
- Status de todos los sistemas AlienFlow
- Uptime de feeds, edge functions, cámaras
- Métricas: requests/min, latencia, datos procesados
- Grid de status cards tipo devops dashboard

#### 7. Edge Function para Movers/Feed
**`supabase/functions/crypto-feed/index.ts`** (nuevo)
- Proxy a CoinGecko API para top movers
- Proxy Firecrawl search para news feed
- Cacheo básico en respuesta

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `src/components/globe/GlobeScene.tsx` | Raycasting + click handler + estado hotspot seleccionado |
| `src/components/dashboard/GlobeOverlay.tsx` | CountryPopup con datos mercado + UAP |
| `src/components/dashboard/FeedTab.tsx` | **Nuevo** — News feed via Firecrawl |
| `src/components/dashboard/MoversTab.tsx` | **Nuevo** — CoinGecko top movers |
| `src/components/dashboard/PortfolioTab.tsx` | **Nuevo** — Portfolio tracker demo |
| `src/components/dashboard/AlertsTab.tsx` | **Nuevo** — Alert config panel |
| `src/components/dashboard/MonitorTab.tsx` | **Nuevo** — System status dashboard |
| `supabase/functions/crypto-feed/index.ts` | **Nuevo** — CoinGecko + news proxy |
| `src/pages/Index.tsx` | Routing para todas las pestañas nuevas |
| `src/components/dashboard/TopNavBar.tsx` | Sin cambios (pestañas ya definidas) |

### Nota sobre CesiumJS
No necesitas pasar ningún token ahora. El globo Three.js actual soporta la interactividad que necesitamos. Cuando quieras migrar a CesiumJS (tiles satelitales reales tipo Google Earth), necesitarás crear una cuenta gratuita en [cesium.com](https://cesium.com) y yo te pediré el token en ese momento.

