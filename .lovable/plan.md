

## Plan: Activar Claude con ANTHROPIC_API_KEY

Ya tienes el secret `ANTHROPIC_API_KEY` configurado. Solo hay que activar Claude en el frontend y añadir el routing en la edge function.

### Cambios

#### 1. `src/lib/ai-models.ts`
- Cambiar Claude de `available: false` → `available: true`
- Actualizar modelo a `anthropic/claude-sonnet-4` (último disponible)

#### 2. `supabase/functions/chat/index.ts`
- Añadir array `ANTHROPIC_MODELS = ["anthropic/claude-sonnet-4"]`
- Incluirlo en `ALLOWED_MODELS`
- Nueva función `routeToAnthropic()` que:
  - Usa `ANTHROPIC_API_KEY` del env
  - Llama a `https://api.anthropic.com/v1/messages` con header `x-api-key` y `anthropic-version: 2023-06-01`
  - Convierte el formato OpenAI (messages con system) al formato Anthropic (system separado + messages)
  - Usa streaming SSE
  - Convierte la respuesta de Anthropic al formato SSE compatible con OpenAI para que el frontend no necesite cambios

#### 3. `src/components/chat/ModelSelector.tsx`
- Sin cambios necesarios — ya tiene el icono `🎭` para Claude

### Archivos a modificar:
| Archivo | Cambio |
|---|---|
| `ai-models.ts` | Claude → `available: true`, actualizar ID |
| `chat/index.ts` | Añadir `routeToAnthropic()`, actualizar ALLOWED_MODELS |

