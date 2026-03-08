

## Plan: Restaurar y Mejorar la Interfaz del Terminal AI Tor

### Problema
La refactorización reciente eliminó elementos clave que funcionaban bien: el AgentSidebar, las cards de capacidades del EmptyState, los botones de herramientas con etiquetas (ANALIZADOR, BUSCADOR, etc.), y la tipografía Nasalization del branding. La versión actual es funcional pero perdió personalidad e información.

### Cambios

#### 1. ChatContainer — Restaurar AgentSidebar
- Importar y renderizar `AgentSidebar` con su toggle, como estaba antes.
- Layout: `flex flex-row` con sidebar a la izquierda y chat a la derecha.

#### 2. EmptyState — Restaurar cards de capacidades + sugerencias rápidas
Volver al diseño de la screenshot:
- Logo AlienFlow + "AI Tor" con tipografía `font-heading` (Nasalization).
- Grid de 6 capability cards con iconos y subtítulos (DeFi & Trading, Búsqueda Web, Seguridad & Auditoría, Quantum Computing, Código & Arquitectura, Web3 & DAO).
- Sección "SUGERENCIAS RÁPIDAS" con chips clickables de prompts reales.
- Status badge del oráculo activo en la esquina.

#### 3. ChatInput — Restaurar botones de herramientas con etiquetas
Volver a los botones con texto visible sobre el input como en la screenshot:
- `[</>  ANALIZADOR]` `[🌐 BUSCADOR]` `[⚡ GENERADOR]` `[🔗 WEB3/DAO]`
- Mantener la barra de input con placeholder "Pregunta al oráculo..." y el botón de imagen.
- Disclaimer en la parte inferior.

#### 4. ChatHeader — Restaurar branding completo
- Izquierda: ⚡ AI Tor con estado online y "Ai Tor" subtítulo.
- Derecha: Botón WALLET, selector de modelo con icono del oráculo activo, toggle del AgentSidebar.
- Usar `font-heading` para "AI Tor".

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/chat/ChatContainer.tsx` | Restaurar AgentSidebar integration |
| `src/components/chat/EmptyState.tsx` | Cards de capacidades + sugerencias rápidas |
| `src/components/chat/ChatInput.tsx` | Botones herramientas con etiquetas visibles |
| `src/components/chat/ChatHeader.tsx` | Branding completo con wallet y sidebar toggle |

### Lo que mejora vs la versión anterior
- Mantiene las mejoras de scroll, markdown rendering y copy button de los mensajes.
- Input más profesional con textarea auto-resize (mejora reciente).
- Modelo selector mejorado con categorías.
- Pero restaura la identidad visual y funcionalidad que se perdió.

