

## Plan: Datos Reales UAP + Fuentes en Tiempo Real

### Situación actual
- UFO tab usa datos mock hardcodeados (6 avistamientos ficticios)
- Las cámaras en vivo ya son reales (YouTube embeds)
- NASA Eyes ya funciona via iframe
- El globo 3D es Three.js propio (no Google Earth)

### Realidad sobre APIs
- **MUFON**: No tiene API pública gratuita (de pago, $100+/año)
- **NUFORC** (National UFO Reporting Center): Tiene datos públicos pero sin API REST oficial
- **Google Earth**: No se puede embeber como iframe; requiere Google Maps JavaScript API + API key
- **explore.org / YouTube**: Ya funcionan como embeds

### Solución propuesta

#### 1. Edge Function `ufo-feed` — Datos reales via scraping
Crear una edge function que use **Firecrawl** (ya disponible como connector) para extraer datos reales de:
- **NUFORC** (`nuforc.org/webreports`) — últimos avistamientos reportados
- **UAP news** vía búsqueda web con Firecrawl search

Esto nos da datos reales en vez de mock. Se cachean en una tabla `uap_sightings` en la base de datos.

#### 2. Tabla `uap_sightings` (migración)
```sql
CREATE TABLE uap_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL,
  date_reported date,
  type text,
  severity text DEFAULT 'signal',
  description text,
  source text,
  source_url text,
  lat float,
  lon float,
  created_at timestamptz DEFAULT now()
);
-- RLS: lectura pública
```

#### 3. Frontend `UFOMonitorTab.tsx`
- Reemplazar `MOCK_SIGHTINGS` por fetch real desde la tabla `uap_sightings`
- Agregar botón "Refresh Feed" que invoca la edge function para traer datos nuevos
- Más cámaras en vivo (ISS, volcanes, naturaleza, zonas de avistamiento)

#### 4. Más cámaras en tiempo real
Agregar embeds de:
- ISS HD Earth Viewing (NASA)
- Volcán Popocatépetl (México)
- Northern Lights cam (Noruega)
- Skinwalker Ranch area cams
- explore.org wildlife cams adicionales

#### 5. Prerequisito: Conectar Firecrawl
Necesitamos el connector Firecrawl para hacer scraping de NUFORC y búsquedas web de UAP news.

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `supabase/functions/ufo-feed/index.ts` | **Nuevo** — scrape NUFORC + search UAP news via Firecrawl |
| DB migration | Tabla `uap_sightings` |
| `src/components/dashboard/UFOMonitorTab.tsx` | Datos reales desde DB + más cámaras |

### Nota sobre Google Earth
Google Earth no se puede embeber como iframe. Para un globo tipo glint.trade con datos geoespaciales reales, la mejor opción es mejorar nuestro globo Three.js existente (ya implementado en Markets) o usar **CesiumJS** (open source, permite tiles satelitales reales). Esto sería un paso separado.

### Pregunta
Necesito conectar Firecrawl como connector para poder hacer scraping de datos reales. ¿Procedo con la conexión?

