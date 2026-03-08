

## Plan: Mejora UI/UX Comercial y Profesional

Tras revisar el código actual y el replay de sesión, propongo las siguientes mejoras manteniendo la identidad AlienFlow:

### 1. ChatContainer — Layout más pulido y comercial
- Eliminar el overlay `SYS_OS // v69` redundante (ya está en el header)
- Mejorar el spacing y padding para una apariencia más limpia
- Suavizar los bordes HUD (menos "hacker", más "premium futurista")
- Toolbelt inferior: rediseñar con iconos más grandes y tooltips, aspecto de barra de herramientas profesional
- Disclaimer: más compacto, una sola línea

### 2. ChatHeader — Simplificar y profesionalizar
- Eliminar la barra de semáforo Mac (innecesaria, ocupa espacio)
- Consolidar en una sola fila: logo/nombre a la izquierda, controles a la derecha
- Botón Wallet más prominente con gradiente neón gold→lime
- Selector de oráculos más grande y legible
- Mostrar nombre del usuario autenticado con avatar

### 3. EmptyState — Convertir en landing comercial
- Añadir el logo AlienFlow centrado con glow
- Título grande "AI Tor" con subtítulo descriptivo comercial
- Los módulos de especialización en tarjetas más visuales con iconos grandes
- Sugerencias de prompts rápidos (chips clicables) debajo de los módulos
- Boot sequence más rápido (reducir delays) o hacerlo opcional

### 4. ChatMessage — Burbujas más modernas
- Mensajes del usuario: burbuja con fondo primario sutil, alineados a la derecha
- Mensajes de AI Tor: fondo card con borde lime sutil, alineados a la izquierda
- Eliminar el indicador lateral (barra vertical) por bordes redondeados
- Avatares más prominentes y redondos
- Markdown rendering para respuestas formateadas

### 5. ChatInput — Más moderno y accesible
- Input más alto con bordes redondeados prominentes
- Botón de envío con gradiente neón (no ghost)
- Placeholder más descriptivo: "Pregunta al oráculo..."
- Eliminar el `λ>` y el cursor `_` parpadeante (menos terminal, más chat comercial)

### 6. AgentSidebar — Panel más limpio
- Quitar info de Moltbook/Twitter de la vista principal si la API no funciona
- Mostrar métricas y capacidades de forma más visual con progress bars
- Avatar del agente más grande y profesional

### Archivos a modificar:
| Archivo | Cambios |
|---------|---------|
| `src/components/chat/ChatContainer.tsx` | Layout simplificado, toolbelt rediseñado |
| `src/components/chat/ChatHeader.tsx` | Una fila, sin semáforo, wallet prominente |
| `src/components/chat/EmptyState.tsx` | Landing comercial con logo, prompts rápidos |
| `src/components/chat/ChatMessage.tsx` | Burbujas modernas, alineación chat |
| `src/components/chat/ChatInput.tsx` | Input moderno sin estética terminal |
| `src/components/chat/AgentSidebar.tsx` | Panel más limpio |

