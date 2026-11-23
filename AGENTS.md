# AiTor v.69 - Neural Intelligence Core

## Arquitectura de Agentes

> **Ojo:** los agentes de `backend/` están escritos, pero hoy **nada los
despliega** (ni `package.json`, ni `vercel.json`, ni un Dockerfile los arrancan).
> Lo que responde en producción es el webhook de Telegram
> (`api/telegram-webhook.ts`) contra la función `chat` de Supabase. El estado
> real, fase a fase, está en [ROADMAP.md](ROADMAP.md).

### Swarms de Agentes

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI TOR SWARM ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐                                                │
│   │  Supervisor │ ◄── Enruta requests al agente correcto          │
│   └──────┬──────┘                                                │
│          │                                                        │
│          ├──────────────────────────────────────┐                  │
│          │                                      │                  │
│          ▼                                      ▼                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐         │
│   │   Manus     │  │ Social      │  │ Security         │         │
│   │   Agent     │  │ Media Mgr   │  │ Agent            │         │
│   └─────────────┘  └─────────────┘  └─────────────────┘         │
│          │                                      │                  │
│          │                                      │                  │
│          ▼                                      ▼                  │
│   ┌─────────────┐                       ┌─────────────┐           │
│   │ RAG Physics │                       │ npm audit   │           │
│   │ RAG DAO     │                       │ Deps check  │           │
│   └─────────────┘                       └─────────────┘           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Agentes Disponibles

Ninguno tiene comando en el bot ni proceso que lo arranque: lo de abajo es el
diseño de `backend/`, no algo que responda hoy (ROADMAP fases 9–10).

### 1. Supervisor Agent
**Rol**: Director de tráfico - decide qué agente procesa cada request

**Categorías detectadas**:
- `RAG_PHYSICS` - Física Tesla, neutrinos, factor 16.18
- `MARKET_DAO` - DeFi, tokens, mercados
- `TASK_MANUS` - Tareas técnicas, automatización
- `SOCIAL_MEDIA` - Gestión de redes sociales
- `SECURITY_SCAN` - Auditoría de seguridad
- `CHAT_GENERAL` - Conversación general

### 2. Manus Agent
**Rol**: Ejecutor técnico

**Capacidades**:
- Análisis de código
- Generación de scripts
- Automatización de tareas
- Investigación técnica

### 3. Social Media Manager Agent 🆕
**Rol**: Gestión de redes sociales

**Plataformas**:
- Twitter/X
- LinkedIn (Company + Founder)
- Instagram
- Facebook
- Discord
- Telegram
- FarcaSter
- GitHub
- HackMD
- DoraHacks

**Frecuencias**:
- `daily` - Posts diarios (9 AM UTC)
- `weekly` - Calendario semanal (Lunes 10 AM)
- `monthly` - Estrategia mensual
- `quarterly` - Plan trimestral
- `yearly` - Estrategia anual

**Workflow**:
```
Generar → Presentar → Aprobar → Programar → Publicar
```

**Comandos**:
```
"genera posts diarios" → Genera contenido
"ver propuestas" → Lista pendientes
"aprobar [id]" → Aprueba para publicación
"rechazar [id]" → Rechaza propuesta
"estadísticas" → Muestra stats
```

### 4. Security Agent 🆕
**Rol**: Auditor de seguridad

**Escaneos**:
- `quickScan()` - npm audit
- `fullScan()` - Completo (npm audit + outdated + secrets)

**Frecuencia recomendada**:
- Diario: Escaneo rápido (8 AM UTC)
- Semanal: Auditoría completa (Lunes 9 AM UTC)

## Workflow de Monetización

```
User Request
     │
     ▼
┌─────────────┐
│ Supervisor  │──► Verifica créditos
│ Route       │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐
│ Check Access │───►│ Si no hay   │
│ (Monetize)  │    │ créditos:   │
└──────┬──────┘    │ Upsell msg   │
       │           └──────────────┘
       ▼
┌─────────────┐
│ Ejecuta     │
│ Request     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Deduct      │
│ Credits     │
└─────────────┘
```

## RAG (Retrieval Augmented Generation)

### Knowledge Bases

1. **Physics Knowledge**
   - Física Tesla 3-6-9
   - Factor 16.18
   - Geometría sagrada
   - Neutrinos y gravedad

2. **DAO Knowledge**
   - Estructura de AlienFlowSpace
   - Tokenomics A₿TC
   - Ecosistema DeFi
   - Governance

3. **Social Media Knowledge** 🆕
   - Voz de marca
   - Mejores prácticas por plataforma
   - Calendario de contenido
   - Hashtags y estrategias

## Loops de Automatización

### Social Media Loops

`start()` sólo tiene sentido dentro de `backend/server.ts`, que no está
desplegado; nada lo llama.

```typescript
SocialAutomationLoops.initialize();
SocialAutomationLoops.start();

// Configuración por defecto
- daily: enabled, 9 AM UTC
- weekly: enabled, Lunes 10 AM
- monthly: enabled, día 1, 9 AM
- quarterly: enabled, inicio trimestre
- yearly: disabled (requiere revisión manual)
```

### Security Loops
- Diario: Quick scan (8 AM)
- Semanal: Full audit (Lunes 9 AM)
- Mensual: Reporte a GitHub

## APIs de Redes Sociales

Los adaptadores están en `backend/socialPublisher.ts` y necesitan credenciales;
sin proceso desplegado no publican nada.

### Configuración Requerida

```bash
# Twitter
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# LinkedIn
LINKEDIN_ACCESS_TOKEN=

# Discord  
DISCORD_WEBHOOK_URL=
# o
DISCORD_BOT_TOKEN=

# Facebook
FACEBOOK_PAGE_ACCESS_TOKEN=

# Instagram
INSTAGRAM_ACCESS_TOKEN=

# FarcaSter
FARCASTER_PRIVATE_KEY=

# GitHub
GITHUB_TOKEN=
```

## Comandos del Sistema

### Bot de Telegram — lo que responde hoy

<!-- comandos:inicio -->
Generado por `npm run docs:comandos` desde `api/_shared/bot-commands.ts`.
No lo edites a mano: `api/_shared/bot-commands.test.ts` falla si no coincide con la tabla.

| Comando | Alias | Qué hace | Uso | Coste |
| --- | --- | --- | --- | --- |
| `/ayuda` | `/help` | Esta lista, pintada desde la tabla que atiende los comandos. | — | — |
| `/estado` | — | Qué está vivo ahora mismo: webhook, memoria, alertas, dedupe y conocimiento. | — | — |
| `/alerta` | — | Aviso de precio, movimiento, sismo o noticia nueva; se guarda y te aviso aquí. | `/alerta BTC > 95000` | — |
| `/manus` | `/investigar`, `/analizar` | Manda una tarea larga a Manus AI y te trae el resultado. | `/manus analiza las tendencias crypto de esta semana` | gasta cuota |
| `/start` | — | Bienvenida y la lista de comandos. | — | — |
| `/web` | — | Terminal web, con el mismo hilo de conversación. | — | — |
| `/app` | — | Enlace a la Mini App de Alien69Bot. | — | — |
| `/dao` | — | Qué es AlienFlow DAO. | — | — |

Sin comando, el mensaje va al chat: es la vía para preguntar en lenguaje natural.
<!-- comandos:fin -->

Lo de abajo es el diseño del supervisor (texto libre, no comandos del bot).

### Redes Sociales
```
# Generar contenido
"genera posts diarios"
"crea contenido semanal para Twitter"
"propuesta mensual"
"estrategia trimestral"

# Gestionar propuestas
"ver propuestas"
"aprobar daily_twitter_123"
"rechazar weekly_linkedin_456"
"estadísticas"

# Reportes
"métricas de redes sociales"
"rendimiento mensual"
```

### Seguridad
```
"escaneo rápido"
"escaneo completo"
"auditoría de seguridad"
"ver vulnerabilidades"
"actualizar dependencias"
```

### Generales
```
"estado del sistema"
"help"
"reiniciar memoria"
```

## Dependencias del Proyecto

```json
{
  "dependencies": {
    "@langchain/google-genai": "latest",
    "@langchain/core": "latest"
  }
}
```

## Variables de Entorno

```bash
# AI Tor
GEMINI_API_KEY=                    # Google Gemini API

# Telegram (ya configurado)
TELEGRAM_BOT_TOKEN=                # Bot de Telegram

# Social Media (por configurar)
TWITTER_API_KEY=
LINKEDIN_ACCESS_TOKEN=
DISCORD_WEBHOOK_URL=
# etc.

# Seguridad
GITHUB_TOKEN=                      # Para advisories
```

## Métricas del Sistema

```typescript
interface SystemStats {
  proposals: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    published: number;
  };
  security: {
    lastScan: Date;
    vulnerabilities: number;
    critical: number;
  };
  agents: {
    requests: number;
    avgResponseTime: number;
  };
}
```

## Estado y roadmap

El roadmap vive en **[ROADMAP.md](ROADMAP.md)** y es la única fuente de verdad,
incluido qué significa cada estado (✅ · 🟡 · ⏭). Aquí no se repite: una sola
definición, la de ese fichero.

Este fichero tenía antes su propio roadmap («Fase 1 ✅ … Fase 4 📋») que
contradecía al de `ROADMAP.md` y marcaba con ✅ cosas que nunca llegaron a
producción: la memoria del hilo (hoy `POST /functions/v1/chat-thread` responde
404) y el bucle de monetización. Se retiró para que no haya dos listas: la buena
es la de `ROADMAP.md`.
