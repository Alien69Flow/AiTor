

# Plan: Integrar skill.md + Restaurar Modelos + Verificar Funcionalidad

## 1. Archivo skill.md - Necesario

No se encontro ningun archivo `skill.md` en el repositorio. Para integrarlo como configuracion real del protocolo Moltbook en el AgentSidebar, necesito que lo compartas (puedes pegarlo en el chat o subirlo como archivo).

Una vez recibido, se integrara como:
- Datos estaticos en `src/lib/moltbook-config.ts` que alimenten el AgentSidebar
- Capacidades, metadata y status del agente extraidos directamente del skill.md

## 2. Restaurar Modelos Desaparecidos

Los 11 modelos actuales en `ai-models.ts` corresponden exactamente a los modelos soportados por el gateway de Lovable AI. Segun las notas del proyecto, existian oráculos placeholder para expansion futura:

- **DeepSeek R1** - Razonamiento open-source
- **Grok 3** - xAI 
- **Claude 4 Sonnet** - Anthropic
- **ChainGPT** - Oracle Web3
- **Chainlink Functions** - Oracle descentralizado

Estos se restauraran como oráculos con `available: false` y un badge "COMING SOON" en el selector, manteniendo la vision multi-oráculo sin romper la funcionalidad (ya que no estan disponibles en el gateway).

## 3. Correccion de Bugs Detectados

### 3a. Fallback directo a Google API (CRITICO)
El diff muestra un "protocolo de contingencia" en `useChat.ts` (lineas 72-93) que llama directamente a `generativelanguage.googleapis.com` con una API key vacia. Esto:
- Nunca funcionara (key vacia)
- Viola la arquitectura (llamadas directas desde el cliente)
- Se eliminara completamente

### 3b. System prompt duplicado
`useChat.ts` envia un `TESLA_ORACLE_PROMPT` como primer mensaje, pero el edge function `chat/index.ts` ya inyecta su propio `SYSTEM_PROMPT`. Resultado: prompt duplicado. Se eliminara el del cliente.

### 3c. Warning de refs en ChatInput
Los `Tooltip` wrapping `Button` generan warnings de refs. Se corregira con `forwardRef` o reestructurando.

## 4. Verificacion End-to-End

Despues de implementar, se probara:
- Streaming de texto con modelos como Gemini 2.5 Flash y GPT-5
- Generacion de imagenes con Imagen 4.0
- Selector de modelos mostrando los 16+ oraculos (11 activos + 5 placeholder)
- Sidebar del agente con datos de Moltbook

## Secuencia Tecnica

1. Crear `src/lib/moltbook-config.ts` con estructura placeholder (se actualizara con el skill.md real)
2. Actualizar `src/lib/ai-models.ts` - agregar 5 modelos placeholder con `available: false`
3. Limpiar `src/hooks/useChat.ts` - eliminar fallback directo y prompt duplicado del cliente
4. Actualizar `src/components/chat/ModelSelector.tsx` - badge "SOON" para modelos no disponibles
5. Actualizar `src/components/chat/AgentSidebar.tsx` - consumir config de Moltbook
6. Fix warnings de refs en `ChatInput.tsx`
7. Desplegar edge function y probar

