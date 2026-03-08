

## Plan: Sidebar oculto por defecto + Modelos AI corregidos + Iconos correctos

### Contexto

El usuario quiere: (1) sidebar oculto por defecto que se despliegue con el botón existente, (2) corregir modelos AI con los IDs reales del gateway + activar Grok con su API key, (3) iconos correctos: AI Tor = ⚡ (rayo), AlienFlow Pro = 👽 (alien).

Secrets disponibles: `LOVABLE_API_KEY`, `GROK_API_KEY`, `OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`

---

### 1. `src/components/chat/ChatContainer.tsx`
- Cambiar `useState(true)` → `useState(false)` para `sidebarOpen` (línea 19)
- Sin otros cambios

### 2. `src/components/chat/AgentSidebar.tsx`
- Mantener toggle funcional pero empezar cerrado
- Cambiar icono del agente de 👽 → ⚡ (AI Tor = rayo)
- Mejorar UI: chips compactos en vez de progress bars, layout más limpio

### 3. `src/lib/ai-models.ts` — Corregir IDs + agregar modelos

| Actual (inválido) | Correcto (gateway real) |
|---|---|
| `openai/gpt-4o` | `openai/gpt-5` |
| `openai/gpt-4o-mini` | `openai/gpt-5-mini` |

Nuevos modelos activos:
- `openai/gpt-5-nano` — ultra rápido
- `google/gemini-3-flash-preview` — nueva generación
- `google/gemini-2.5-flash-lite` — económico

Grok → `available: true` (tiene `GROK_API_KEY`)

Iconos:
- AI Tor (gemini-flash) → ⚡
- AlienFlow Pro (gemini-pro) → 👽
- GPT-5 → 🧠, Grok → 🚀, Claude → 🎭

### 4. `supabase/functions/chat/index.ts` — Multi-router

- Actualizar `ALLOWED_MODELS` con todos los IDs correctos + grok
- Router: modelos Lovable Gateway → `ai.gateway.lovable.dev`, Grok → `api.x.ai/v1/chat/completions` con `GROK_API_KEY`
- Actualizar CORS headers

### 5. `src/components/chat/ModelSelector.tsx`
- Actualizar `getOracleIcon`: gemini-flash → ⚡, gemini-pro → 👽

### 6. `src/components/chat/ChatHeader.tsx`
- Cambiar icono 👽 → ⚡ para AI Tor

### Archivos a modificar:
| Archivo | Cambio |
|---|---|
| `ChatContainer.tsx` | `sidebarOpen` default `false` |
| `AgentSidebar.tsx` | Icono ⚡, chips en vez de barras |
| `ai-models.ts` | Corregir IDs, activar Grok, agregar modelos |
| `chat/index.ts` | Multi-router Gateway + Grok, ALLOWED_MODELS |
| `ModelSelector.tsx` | Iconos ⚡/👽 correctos |
| `ChatHeader.tsx` | Icono ⚡ |

