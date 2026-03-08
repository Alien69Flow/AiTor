

## Plan: Verde Fosforito + Pestañas UFO/Solar System + Globo Mejorado

### 1. Color Scheme → Verde Fosforito (#00FF41)

**Archivo: `src/index.css`**

Cambiar todas las variables CSS de dorado (`51 100% 50%`) a verde fosforito (`120 100% 50%`):
- `--primary`, `--foreground`, `--card-foreground`, `--popover-foreground` → `120 100% 50%`
- `--muted-foreground` → `120 30% 50%`
- `--ring` → `120 100% 50%`
- `--glow-gold` → `120 100% 50%`
- Sidebar variables también a verde
- Actualizar `.neon-text-gold` para usar `hsl(120 100% 50%)` en vez de `hsl(51...)`
- Mismos cambios en `.dark` y `.light` blocks

### 2. Menú Ampliado con Pestañas Nuevas

**Archivo: `src/components/dashboard/TopNavBar.tsx`**
- Actualizar `TabId` type: añadir `"ufo"` y `"solar"`
- Añadir al array TABS:
  - `{ id: "ufo", label: "UFO/Alien" }`
  - `{ id: "solar", label: "Solar System" }`
- Cambiar `neon-text-gold` → `neon-text-lime` en el logo

**Archivo: `src/pages/Index.tsx`**
- Importar los nuevos componentes
- Añadir routing: `ufo` → `<UFOMonitorTab />`, `solar` → `<SolarSystemTab />`

### 3. Nuevas Pestañas

**Nuevo: `src/components/dashboard/SolarSystemTab.tsx`**
- Iframe embebido de NASA Eyes: `https://eyes.nasa.gov/apps/solar-system/#/home`
- Pantalla completa con overlay de controles AlienFlow
- Fallback loading state

**Nuevo: `src/components/dashboard/UFOMonitorTab.tsx`**
- Panel dividido en 2 columnas:
  - **Izquierda**: Feed de avistamientos UFO (datos mock tipo MUFON: ubicación, fecha, tipo, severidad)
  - **Derecha**: Grid de cámaras en vivo (embeds YouTube/explore.org iframes)
    - ISS Live Feed, explore.org cámaras naturaleza, etc.
- Badges: 🛸 UAP Confirmed, ⚠️ Under Investigation, 📡 Signal Detected
- Zona de alertas anomalías en tiempo real (mock data)

### 4. Globo 3D Mejorado

**Archivo: `src/components/globe/GlobeScene.tsx`**
- Aumentar densidad continentes: 3000 → 6000 puntos
- Cambiar color continentes de verde a verde fosforito (`0.0, 1.0, 0.25`)
- Añadir **arcos animados** entre hotspots (líneas curvas tipo vuelos/señales)
- Grid lines color → verde fosforito tenue
- Glow atmosférico → verde fosforito
- Rotación más lenta y enfoque inicial hacia vista global

### Archivos a modificar/crear:

| Archivo | Cambio |
|---|---|
| `src/index.css` | Todo el color scheme → verde fosforito |
| `src/components/dashboard/TopNavBar.tsx` | +2 pestañas, texto verde |
| `src/pages/Index.tsx` | Routing nuevas pestañas |
| `src/components/globe/GlobeScene.tsx` | Colores verde, más densidad, arcos |
| `src/components/dashboard/SolarSystemTab.tsx` | **Nuevo** — NASA Eyes iframe |
| `src/components/dashboard/UFOMonitorTab.tsx` | **Nuevo** — MUFON feed + live cams |

