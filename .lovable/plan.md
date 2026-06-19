## Diagnóstico actual (pestaña Globe)

`GlobeDashboard.tsx` apila paneles fijos sobre el globo sin reservar espacio:

- **Izquierda (top-3 left-3):** `TacticalConsole` + `LegendPanel` + `NavigatePanel` apilados en columna → en mobile cubren todo el ancho y tapan el planeta entero.
- **Derecha:** `ChatFeedPanel` ancho fijo (`hidden md:block`), siempre visible en desktop.
- **Centro-abajo:** Nav dock + `OsintTickerBar` + status footer ocupan ~120 px de alto del globo.
- **Arriba:** Crypto ticker + `LiveTicker` añaden otra franja.
- En mobile no hay paneles colapsables: o todo visible o nada. La columna izquierda llega hasta media pantalla.

Resultado: en móvil el planeta queda como una franja de 30 % en el centro; en desktop la consola izquierda solapa la parte oeste del globo.

## Objetivo (basado en la referencia "Gemini_G")

- Planeta siempre como protagonista, centrado y sin solapes verticales con el dock inferior.
- Paneles laterales **colapsables a un icono-rail** (rail de 44 px) en desktop; el contenido se abre on-demand.
- En mobile, los paneles se convierten en **bottom-sheets / drawers** disparados desde una barra inferior con iconos (Tactical, Legend, Navigate, Feed, Markets).
- Top: un único ticker compacto (combinar crypto + OSINT) con altura ≤ 36 px.
- Bottom dock: agrupa nav dock + status en una sola barra de 48 px con glass.

## Cambios de código

### 1. `GlobeDashboard.tsx` — nuevo layout responsivo
- Detectar `useIsMobile()`.
- **Desktop (≥ md):**
  - Rail izquierdo (w-12) con 3 iconos: Tactical / Legend / Navigate. Click expande un panel flotante (w-72) hacia la derecha, con cierre.
  - Rail derecho (w-12) con icono Feed → expande `ChatFeedPanel` (w-80) o se cierra.
  - Dock inferior centrado mantiene Markets/Feed/Alerts/Movers/Tension pero pasa a altura compacta 40 px.
  - Solo un panel lateral abierto a la vez por lado (estado controlado).
- **Mobile (< md):**
  - Ocultar rails y paneles flotantes.
  - Añadir `MobileGlobeBar` fijo abajo: iconos Tactical, Legend, Navigate, Feed, Markets. Tap abre `Sheet` (shadcn) desde abajo con el panel correspondiente.
  - Ticker superior queda en una sola línea (max-h-9), con `truncate` y `no-scrollbar`.
  - `LiveTicker` y `OsintTickerBar` se fusionan en un único componente `UnifiedTicker` con tabs (Crypto | OSINT) para no apilar dos barras.

### 2. Componentes nuevos
- `src/components/dashboard/GlobePanelRail.tsx` — rail vertical con icon buttons + estado `openId | null`.
- `src/components/dashboard/MobileGlobeBar.tsx` — bottom bar móvil + `Sheet` por panel.
- `src/components/dashboard/UnifiedTicker.tsx` — fusiona crypto + OSINT en una sola fila colapsable.

### 3. Ajustes en paneles existentes
- `TacticalConsole`, `LegendPanel`, `NavigatePanel`, `ChatFeedPanel`: aceptar prop `embedded?: boolean` para quitar el `position: absolute`/anchos fijos cuando viven dentro del rail-popover o del `Sheet` (full width en sheet, max-w-xs en popover desktop).
- Quitar `hidden md:block` del `ChatFeedPanel`; ahora se controla por rail/sheet.

### 4. Footer status
- Pasar de barra siempre visible a chip integrado en el dock inferior (badges NASA/USGS/NOAA inline). Libera 32 px de alto.

### 5. Z-index / pointer-events
- Rails siempre encima (z-40). Paneles flotantes z-30 con backdrop-blur fuerte.
- `pointer-events-none` en el contenedor del globo cuando un panel mobile-sheet está abierto, para evitar arrastres accidentales.

## Estructura visual resultante

```text
┌────────────────────────────────────────────────┐
│ Unified ticker (36px) Crypto · OSINT · KP      │
├──┬──────────────────────────────────────────┬──┤
│▣ │                                          │▣ │
│▣ │              🌍  PLANETA                  │▣ │   ← rails 48px
│▣ │            (siempre centrado)            │▣ │
│▣ │                                          │▣ │
├──┴──────────────────────────────────────────┴──┤
│ ◯ Markets ◯ Feed ◯ Alerts ◯ Tension · NASA/USGS │  ← dock 48px
└────────────────────────────────────────────────┘
```

En mobile:

```text
┌──────────────────────────┐
│ Unified ticker (32px)    │
├──────────────────────────┤
│                          │
│        🌍 PLANETA         │
│                          │
├──────────────────────────┤
│ ◯ Tact ◯ Leg ◯ Nav ◯ Feed │  ← bottom bar 56px
└──────────────────────────┘
   (cada icon abre Sheet)
```

## Out of scope
- No se cambia la lógica de datos (`useUnifiedIntel`, hooks de NASA/USGS).
- No se toca el render 3D (`GlobeScene.tsx`).
- No se redibujan los paneles internos, solo se hacen "embeddables".

## Verificación
1. Inspección visual en desktop y mobile (preview viewport switch).
2. Confirmar que el globo queda visible al 100 % cuando los rails están colapsados.
3. Confirmar que ningún panel solapa el planeta cuando se abre (los rails empujan vía popover, no encima del globo central).
