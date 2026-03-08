

## Plan: Rediseñar Terminal AI Tor — Estilo ChatGPT/Claude Profesional con Capacidades Reales

### Problema
La interfaz actual tiene buena base pero se siente "demo": el Control Room muestra datos fake, el chat es funcional pero no alcanza la calidad UX de Claude/GPT, y las quick actions no ejecutan capacidades reales.

### Filosofía del Rediseño
Mantener la estética terminal verde neón (identidad del proyecto), pero elevar la calidad UX al nivel de ChatGPT/Claude: centrado en la conversación, espacio limpio, interacciones pulidas.

### Cambios Propuestos

#### 1. ChatContainer — Layout estilo Claude/GPT
- Eliminar el Control Room sidebar (datos fake, distrae). Mover la info útil al header.
- Chat ocupa todo el ancho disponible, centrado con `max-w-3xl`.
- Eliminar el wrapper con max-w-6xl y h-calc del Index.tsx — el chat debe ocupar todo el espacio del tab.

#### 2. ChatHeader — Compacto y funcional
- Barra superior minimalista: logo + nombre a la izquierda, selector de modelo al centro, acciones (nuevo chat, login/logout) a la derecha.
- Indicador de modelo activo con punto de estado verde.
- Quitar el botón de Control Room.

#### 3. ChatMessage — Burbujas modernas
- Mantener layout actual (avatar izquierda, contenido derecha) que ya es estilo Claude.
- Mejorar spacing y typography para que sea más legible.
- Añadir botones de acción en hover: Copiar, Regenerar (para mensajes del asistente).
- Mantener markdown rendering con `react-markdown`.

#### 4. ChatInput — Barra de entrada estilo ChatGPT
- Input redondeado centrado en la parte inferior.
- Mantener prefijo `AITOR >` como toque de marca.
- Mejorar quick actions: convertirlas en "suggestion chips" que aparecen SOLO en el EmptyState (como hace Claude/GPT), no flotando siempre encima del input.
- Mantener upload de imagen y Enter para enviar.

#### 5. EmptyState — Pantalla de bienvenida mejorada
- Logo grande + nombre.
- Grid de 4 suggestion cards con las capacidades REALES conectadas:
  - "Analiza el mercado DeFi actual" (usa Gemini/GPT real)
  - "Busca las últimas noticias crypto" (usa Firecrawl)
  - "Genera contenido para X/Twitter" (usa AI real)
  - "Audita un smart contract" (usa AI real)

#### 6. ModelSelector — Mostrar solo modelos reales conectados
- Secrets disponibles: LOVABLE_API_KEY, GROK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY.
- Modelos realmente funcionales: todos los Lovable Gateway (Gemini, GPT-5), Grok 2, Claude Sonnet 4.
- Marcar como "Soon" solo ChainGPT, Chainlink, DeepSeek (los que no tienen API key).
- Limpiar el selector para que sea más claro y compacto.

#### 7. Index.tsx — Terminal sin restricciones de tamaño
- Quitar el wrapper `max-w-6xl h-[calc(100vh-100px)]` del case "terminal".
- El ChatContainer debe ocupar `flex-1` completo.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/Index.tsx` | Terminal ocupa todo el espacio |
| `src/components/chat/ChatContainer.tsx` | Eliminar ControlRoom, layout limpio estilo Claude |
| `src/components/chat/ChatHeader.tsx` | Compacto, sin botón Control Room |
| `src/components/chat/ChatMessage.tsx` | Pulir spacing, añadir Regenerar |
| `src/components/chat/ChatInput.tsx` | Quitar quick actions de aquí |
| `src/components/chat/EmptyState.tsx` | Suggestion cards con capacidades reales |
| `src/components/chat/ThinkingIndicator.tsx` | Simplificar animación |

### Lo que se conserva
- Estética terminal verde neón (colores, font-mono)
- Streaming SSE palabra por palabra
- Markdown rendering
- Upload de imágenes
- Todos los modelos AI conectados (Gemini, GPT-5, Grok, Claude)
- Prefijo `AITOR >` en el input
- Logo cerebro como avatar

### Lo que se elimina
- Control Room sidebar (datos simulados sin valor real)
- Quick action buttons flotantes sobre el input (se mueven al EmptyState)

