

## Plan: Consolidar navegación en 6 secciones principales

### Resumen
Reemplazar las 12 pestañas actuales por 6 secciones (AGENTS, ALIEN, COSMOS, GLOBE, MARKETS, SYSTEM). Desktop usa sidebar colapsable con iconos; móvil usa bottom navigation bar con 6 iconos. Se elimina completamente el `TopNavBar` con pestañas horizontales.

### Arquitectura de navegación

```text
┌─────────────────────────────────────────┐
│  Header (logo + actions)                │
├────────┬────────────────────────────────┤
│Sidebar │                                │
│(desktop│     Active Section Content     │
│ icons) │                                │
├────────┴────────────────────────────────┤
│  Bottom Nav (mobile only, 6 icons)      │
└─────────────────────────────────────────┘
```

### Mapeo de secciones

| Sección | Icono | Contenido |
|---------|-------|-----------|
| **AGENTS** (Home) | `Bot` | `ChatContainer` + `AgentsTab` fusionados (chat IA con sidebar de agentes) |
| **ALIEN** | `Radio` | `UFOMonitorTab` (sin cambios internos) |
| **COSMOS** | `Orbit` | `SolarSystemTab` (renombrado) |
| **GLOBE** | `Globe` | `GlobeDashboard` (Cesium globe) |
| **MARKETS** | `BarChart3` | Nueva vista unificada con sub-tabs internas: Markets, Signals, Feed, Movers, Portfolio, Alerts, Monitor |
| **SYSTEM** | `Settings` | Nueva vista placeholder: perfil, wallet, API keys, gobernanza DAO |

### Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/components/dashboard/TopNavBar.tsx` | **Reescribir** → Header minimalista (logo + actions) sin pestañas |
| `src/components/dashboard/AppSidebar.tsx` | **Crear** → Sidebar desktop con 6 secciones, colapsable a iconos |
| `src/components/dashboard/BottomNav.tsx` | **Crear** → Bottom nav móvil con 6 iconos |
| `src/components/dashboard/MarketsSection.tsx` | **Crear** → Dashboard unificado con sub-tabs internas (Markets, Signals, Feed, Movers, Portfolio, Alerts, Monitor) |
| `src/components/dashboard/SystemTab.tsx` | **Crear** → Placeholder para DAO dashboard |
| `src/pages/Index.tsx` | **Reescribir** → Layout con SidebarProvider, 6 secciones, bottom nav |
| `src/index.css` | Mantener overflow-x: hidden existente |

### Detalles clave

1. **MarketsSection**: Contenedor con tabs horizontales internas (`Tabs` de shadcn) que renderiza los 7 componentes existentes (MarketsTab, SignalsTab, FeedTab, MoversTab, PortfolioTab, AlertsTab, MonitorTab) sin modificarlos internamente.

2. **Sidebar desktop**: Usa `Sidebar` de shadcn con `collapsible="icon"`. Muestra iconos + labels, se colapsa a solo iconos.

3. **Bottom nav móvil**: Barra fija inferior con 6 iconos, visible solo en `md:hidden`. Reemplaza el menú hamburguesa actual.

4. **Header simplificado**: Solo logo, búsqueda (desktop), wallet button y login/logout. Sin pestañas.

5. **TabId type**: Cambia a `"agents" | "alien" | "cosmos" | "globe" | "markets" | "system"`.

