

## Plan: Reestructuración de AI Tor como Agente Principal Funcional

### Problema actual
1. **Doble barra de navegación**: TopNavBar (header) + AppSidebar (desktop) / BottomNav (mobile) crean redundancia visual
2. **Tool invocation manual**: Las herramientas (Firecrawl, GitHub, CoinGecko) se activan con prefijos de texto ("Busca en la web:", "Analiza el repositorio de GitHub:") en lugar de ser invocadas automáticamente por el agente
3. **No existe una capa de servicios centralizada**: La lógica de herramientas está dispersa en `useChat.ts`

### Cambios propuestos

---

#### 1. Refactor de Navegación: Top Nav con 6 secciones

Eliminar la doble barra. Reemplazar `AppSidebar` + `BottomNav` por un **Top Navigation Bar unificado** con las 6 secciones como tabs horizontales (desktop) y bottom nav (mobile).

| Archivo | Cambio |
|---------|--------|
| `src/components/dashboard/TopNavBar.tsx` | Reescribir: logo a la izquierda, 6 tabs horizontales en el centro (desktop), acciones a la derecha. Sin sidebar trigger |
| `src/pages/Index.tsx` | Eliminar `SidebarProvider` y `AppSidebar`. Solo TopNavBar + content + BottomNav (mobile) |
| `src/components/dashboard/BottomNav.tsx` | Mantener como está para mobile (ya funciona bien) |
| `src/components/dashboard/AppSidebar.tsx` | Eliminar (ya no se usa) |

**TopNavBar** tendrá:
- Logo + nombre a la izquierda
- 6 tabs con iconos (Bot, Radio, Orbit, Globe, BarChart3, Settings) en el centro (hidden en mobile)
- Wallet + Auth a la derecha
- Recibe `activeTab` y `onTabChange` como props

---

#### 2. Tool Layer: `src/services/agentTools.ts`

Crear un archivo de servicios centralizado que extraiga la lógica de herramientas de `useChat.ts`:

```text
agentTools.ts
├── fetchWebContext(query) → usa firecrawl-search
├── analyzeRepo(repoUrl) → usa github-proxy (repo_info + tree + README)
├── editRepo(repoUrl, instruction) → usa github-proxy (create_or_update_file)
├── fetchCryptoPrice(coinId) → usa CoinGecko API (gratis, no necesita key)
└── fetchMarketData(query) → usa crypto-feed edge function existente
```

- `fetchCryptoPrice`: Nueva función que llama a la API pública de CoinGecko (`api.coingecko.com/api/v3/simple/price`) para traer precios reales al chat
- Las otras funciones son refactors de la lógica existente en `useChat.ts`

---

#### 3. Integración automática de herramientas en el Chat

Modificar la edge function `chat/index.ts` y `useChat.ts` para que el agente detecte automáticamente cuándo usar herramientas:

**Enfoque**: Detección por intención en el frontend antes de enviar al LLM.

| Patrón detectado | Herramienta invocada |
|---|---|
| URL de GitHub en el mensaje | `analyzeRepo()` automáticamente |
| Pregunta sobre precio/mercado de crypto | `fetchCryptoPrice()` → inyecta datos reales |
| Pregunta que requiere info actual/web | `fetchWebContext()` automáticamente |
| Instrucción de edición + repo URL | `editRepo()` automáticamente |

**En `useChat.ts`**:
- Añadir función `detectTools(content)` que analiza el mensaje del usuario y decide qué herramientas invocar
- Reemplazar los prefijos manuales (`SEARCH_PREFIX`, `GITHUB_PREFIX`) por detección inteligente
- Mantener compatibilidad con prefijos explícitos como fallback

**Para capacidades no disponibles** (video, imagen):
- Añadir estado `processingExternalNode` con mensaje "Procesando en Nodo Externo..."
- Mostrar un indicador visual en `ThinkingIndicator`

---

#### 4. CoinGecko Integration

| Archivo | Cambio |
|---------|--------|
| `src/services/agentTools.ts` | `fetchCryptoPrice(coinIds)`: llama a CoinGecko API pública |
| `supabase/functions/crypto-price/index.ts` | Nueva edge function proxy para CoinGecko (evitar CORS) |

La API pública de CoinGecko es gratuita (sin key), solo necesitamos un proxy edge function para CORS.

---

### Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `src/components/dashboard/TopNavBar.tsx` | **Reescribir** → Nav unificado con 6 tabs |
| `src/components/dashboard/AppSidebar.tsx` | **Eliminar** |
| `src/pages/Index.tsx` | **Simplificar** → Sin SidebarProvider |
| `src/services/agentTools.ts` | **Crear** → Capa de servicios centralizada |
| `src/hooks/useChat.ts` | **Refactorizar** → Usar agentTools, detección automática |
| `supabase/functions/crypto-price/index.ts` | **Crear** → Proxy CoinGecko |
| `src/components/chat/ThinkingIndicator.tsx` | **Actualizar** → Añadir estado "Nodo Externo" |

