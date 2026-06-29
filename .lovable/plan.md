## Objetivo
Limpiar la duplicación visual del logo en la pestaña Agents y refinar la interfaz móvil del chat (selector de IA, botón flip Chat⟳Neural, hero del empty state). Cambios sólo de UI en frontend.

## 1. Logo duplicado (3 instancias en Agents)

Actualmente el logo `alienflow-logo.webp` aparece en:
- `TopNavBar.tsx` (header global) — **se mantiene** como marca principal.
- `ChatHeader.tsx` (header del chat con "AI Tor / Online") — **se elimina** el `<img>` y se deja sólo el texto "AI Tor" + dot online. El header del chat ya está dentro de la pestaña Agents, así que la marca de la app ya está visible arriba.
- `EmptyState.tsx` (hero gigante con anillos animados que hacen "ondas") — **se mantiene** pero:
  - En móvil (<500px) se reducen los anillos a uno solo y se baja la opacidad para que no parezca un radar pesado.
  - Se reduce el tamaño del logo en móvil de `w-12 h-12` a `w-10 h-10` y se acerca al título para compactar el hero.

Resultado: 2 instancias visibles (nav global + hero) en vez de 3, sin tocar la identidad.

## 2. Selector de IA en móvil

`ModelSelector.tsx` en móvil muestra: icono pill + nombre truncado + badge Fast/Pro + barras de velocidad + chevron, lo que crea las "burbujas" amontonadas.

Cambios:
- En `<500px`: ocultar el badge `ORACLE_TYPE_BADGES` y el `SpeedIndicator` del trigger; dejar sólo icono + nombre + chevron.
- Reducir altura del trigger de `h-9` a `h-8` y padding `px-2` en móvil.
- `PopoverContent`: cambiar `w-[380px]` por `w-[calc(100vw-1rem)] max-w-[380px]` para que no desborde en móvil.

## 3. Botón flip Chat ⟳ Neural (`AgentsFlipCard.tsx`)

Actualmente está en `top-3 right-3` y tapa el botón de cerrar sesión / model selector en móvil.

Cambios:
- En móvil moverlo a `bottom-16 right-3` (encima de la BottomNav) como FAB redondo con sólo el icono (Brain/MessageSquare), sin texto.
- En desktop mantener la posición y el texto actuales.
- Añadir `aria-pressed={flipped}` para accesibilidad.

## 4. ChatHeader compacto en móvil

- Eliminar `<img>` del logo (punto 1).
- Reducir el bloque izquierdo: dejar sólo "AI Tor" con dot pulsante.
- El `ModelSelector` del lado derecho (mobile) queda más visible al liberar espacio.

## 5. Respuesta sobre agentes RAG / Agentic Workflows

No es un cambio de código; va como nota informativa al final de la implementación:

Estado actual de las integraciones con secrets:
- **Configurados y enrutados en `agenticworkflows`**: `ANTHROPIC_API_KEY` (router Claude Sonnet 4), `FIRECRAWL_API_KEY` (search + osint), `GEMINI_API_KEY` (vía función `chat`), `OPENAI_API_KEY` (vía `chat`).
- **Configurados pero NO enrutados aún como tool del router**: `GROK_API_KEY`, `LIVEUAMAP_API_KEY`, `GITHUB_PAT` (sólo usado por `github-proxy` desde el frontend, no expuesto al agentic loop), `VITE_CESIUM_TOKEN` (proxy de tiles, no es una "skill" del agente).
- **Skills RAG (`skills-ingest` + pgvector)**: la función existe pero el router `agenticworkflows` **no consulta el índice vectorial** como tool. Falta una tool `skills_rag_search` que llame a `skills-ingest` en modo query.

Estos huecos se proponen como trabajo separado (no se tocan en este plan que es sólo UI).

## Archivos a modificar

- `src/components/chat/ChatHeader.tsx` — quitar `<img>` logo.
- `src/components/chat/EmptyState.tsx` — reducir anillos y logo en móvil.
- `src/components/chat/ModelSelector.tsx` — simplificar trigger y popover en móvil.
- `src/components/agents/AgentsFlipCard.tsx` — FAB móvil para el botón flip.

Sin cambios en backend, edge functions, ni en otras pestañas.
