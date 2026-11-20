# 🤖 AiTor v.69 - Sistema de Automatización

> **Estado real: nada de esto está en marcha.** El código existe (`backend/agents/`,
> `backend/workflows/socialAutomationLoops.ts`, `socialProposalQueue.ts`,
> `socialPublisher.ts`), pero **ningún proceso lo arranca**: no hay cron, ni
> despliegue, ni entrada en `package.json` que lo lance, y ninguna función de
> `api/` lo importa. Lo único programado en producción es el cron de alertas de
> precio (`/api/cron/price-alerts`), que sigue pendiente de Redis y `CRON_SECRET`
> (ROADMAP fase 5). Esto describe el diseño y cómo se operaría **cuando** haya
> despliegue; lo que cuenta como hecho está en [ROADMAP.md](ROADMAP.md), donde la
> publicación en redes y los workflows con aprobación están en ⏭ (fases 9 y 10).

## 📋 Resumen Ejecutivo

Este documento describe el sistema completo de automatización para AiTor v.69, incluyendo:

- 🐦 **Gestión de Redes Sociales** - Generación, aprobación y publicación automatizada
- 🔐 **Auditoría de Seguridad** - Escaneos programados del repositorio
- 📅 **Loops de Contenido** - Propuestas diarias, semanales, mensuales y anuales

---

## 🎯 Plataformas de Redes Sociales Soportadas

| Plataforma | Username | Estado | API |
|------------|----------|--------|-----|
| Twitter/X | @Alien69Flow | 🔜 Próximamente | Requiere API Key |
| LinkedIn | alienflowspace | 🔜 Próximamente | Requiere Token |
| Instagram | @alien69flow | 🔜 Próximamente | Requiere Token |
| Facebook | @Alien69Flow | 🔜 Próximamente | Requiere Token |
| Discord | AlienFlowSpace | 🔜 Próximamente | Webhook/Bot Token |
| Telegram | @AlienFlowSpaceDAO | ⏸ Sin desplegar | El bot responde en producción, pero este publicador no corre |
| FarcaSter | @alien69flow | 🔜 Próximamente | Requiere Private Key |
| GitHub | @Alien69Flow | 🔜 Próximamente | PAT Token |
| HackMD | @Alien69Flow | 🔜 Próximamente | API Token |
| DoraHacks | @Alien69Flow | 🔜 Próximamente | API Token |

Las filas de arriba describen adaptadores escritos en `backend/socialPublisher.ts`,
no canales operativos: sin credenciales y sin proceso no hay publicación.

---

## 🚀 Workflow de Redes Sociales

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI TOR SOCIAL MEDIA FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────┐          │
│   │ GENERA   │───▶│  PRESENTA    │───▶│     APRUEBA      │          │
│   │CONTENIDO │    │   (Telegram)│    │    (Usuario)    │          │
│   └──────────┘    └──────────────┘    └────────┬─────────┘          │
│                                                  │                    │
│                                                  ▼                    │
│   ┌──────────────────────────────────────────────────────┐          │
│   │                    PROGRAMAR                            │          │
│   │   (Horarios óptimos por plataforma)                  │          │
│   └──────────────────────┬───────────────────────────────┘          │
│                          │                                           │
│                          ▼                                           │
│   ┌──────────────────────────────────────────────────────┐          │
│   │                    PUBLICAR                            │          │
│   │   (APIs de redes sociales)                            │          │
│   └──────────────────────────────────────────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

El diagrama es el diseño. Hoy el paso **PUBLICAR** nunca se ejecuta porque el
paso anterior tampoco existe: en producción no hay nada que genere ni apruebe
propuestas.

## 📅 Tipos de Propuestas

### Diario (Daily)
- **Hora**: 9:00 AM UTC
- **Contenido**: 3-5 posts optimizados por plataforma
- **Plataformas**: Twitter, LinkedIn, Telegram
- **Tono**: Técnico/Educativo

### Semanal (Weekly)
- **Hora**: Lunes 10:00 AM UTC
- **Contenido**: Calendario de 7 días
- **Plataformas**: Twitter, LinkedIn, Instagram, Discord
- **Tono**: Mixto (educativo + community)

### Mensual (Monthly)
- **Hora**: Día 1, 9:00 AM UTC
- **Contenido**: Estrategia + temas principales
- **Plataformas**: LinkedIn, HackMD
- **Tono**: Profesional

### Trimestral (Quarterly)
- **Hora**: Inicio de trimestre
- **Contenido**: Plan estratégico 3 meses
- **Plataformas**: HackMD, GitHub
- **Tono**: Visionario

### Anual (Yearly)
- **Hora**: 1 de Enero
- **Contenido**: Plan maestro anual
- **Plataformas**: HackMD
- **Tono**: Estratégico
- **Nota**: Requiere revisión manual antes de activar

---

## 🔐 Sistema de Seguridad

Los escaneos están escritos en `backend/agents/securityAgent.ts` (ejecuta
`npm audit` con `child_process`), pero no hay programación: ni a las 8:00 ni los
lunes a las 9:00. Nada los dispara.

### Escaneo Diario (Quick Scan)
- **Hora**: 8:00 AM UTC
- **Acciones**: `npm audit`, verificación de outdated
- **Alertas**: Critical/High via Telegram

### Auditoría Semanal (Full Audit)
- **Hora**: Lunes 9:00 AM UTC
- **Acciones**: 
  - `npm audit --json`
  - `npm outdated --json`
  - Búsqueda de secretos hardcoded
  - GitHub Security Advisories
- **Reporte**: Completo con recomendaciones

---

## 💬 Comandos del Sistema

### Redes Sociales

| Comando | Descripción |
|---------|-------------|
| `"genera posts diarios"` | Genera contenido para hoy |
| `"crea contenido semanal"` | Genera calendario semanal |
| `"propuesta mensual"` | Genera estrategia mensual |
| `"estrategia trimestral"` | Genera plan trimestral |
| `"ver propuestas"` | Lista propuestas pendientes |
| `"aprobar [id]"` | Aprueba propuesta específica |
| `"rechazar [id]"` | Rechaza propuesta |
| `"estadísticas"` | Muestra stats del sistema |

### Seguridad

| Comando | Descripción |
|---------|-------------|
| `"escaneo rápido"` | Ejecuta npm audit |
| `"escaneo completo"` | Auditoría completa |
| `"ver vulnerabilidades"` | Lista hallazgos |
| `"actualizar deps"` | Sugiere updates |

---

## ⚙️ Configuración

### Variables de Entorno Requeridas

```bash
# ===========================================
# AI TOR CORE
# ===========================================
GEMINI_API_KEY=                    # Google Gemini API (requerido)

# ===========================================
# TELEGRAM (Ya configurado)
# ===========================================
TELEGRAM_BOT_TOKEN=                # Token del bot de Telegram

# ===========================================
# TWITTER / X
# ===========================================
TWITTER_API_KEY=                   # API Key
TWITTER_API_SECRET=                # API Secret
TWITTER_ACCESS_TOKEN=              # Access Token
TWITTER_ACCESS_SECRET=             # Access Token Secret

# ===========================================
# LINKEDIN
# ===========================================
LINKEDIN_ACCESS_TOKEN=             # OAuth Access Token

# ===========================================
# DISCORD
# ===========================================
DISCORD_WEBHOOK_URL=               # Webhook URL (para posting simple)
# O
DISCORD_BOT_TOKEN=                 # Bot Token (para posting completo)

# ===========================================
# FACEBOOK
# ===========================================
FACEBOOK_PAGE_ACCESS_TOKEN=        # Page Access Token

# ===========================================
# INSTAGRAM
# ===========================================
INSTAGRAM_ACCESS_TOKEN=            # Via Facebook Graph API

# ===========================================
# FARCASTER
# ===========================================
FARCASTER_PRIVATE_KEY=             # Private Key (Neyr Protocol)

# ===========================================
# GITHub
# ===========================================
GITHUB_TOKEN=                      # Personal Access Token

# ===========================================
# HACKMD
# ===========================================
HACKMD_API_TOKEN=                  # API Token

# ===========================================
# DORA HACKS
# ===========================================
DORAHACKS_API_KEY=                 # API Key (si disponible)
```

### Instalación de Dependencias

```bash
cd /workspace/project/AiTor
npm install
```

---

## 🤖 OpenHands Automations

`scripts/setup-automations.sh` es un script de configuración contra la API de
OpenHands. En el repo no hay constancia de que se haya ejecutado ni de que esas
automations existan hoy: los `curl` de abajo son el procedimiento, no un estado.

### Configurar Automations

Ejecuta el script de configuración:

```bash
cd /workspace/project/AiTor
./scripts/setup-automations.sh
```

O manualmente:

```bash
# Automation 1: Daily Social Content (9 AM UTC)
curl -X POST "${OPENHANDS_HOST}/api/automation/v1/preset/prompt" \
  -H "Authorization: Bearer ${OPENHANDS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Social Content - AiTor",
    "prompt": "Genera propuestas de contenido diario para AlienFlowSpace DAO...",
    "trigger": {"type": "cron", "schedule": "0 9 * * *", "timezone": "UTC"},
    "timeout": 300
  }'
```

### Ver Automations Activas

```bash
curl -X GET "${OPENHANDS_HOST}/api/automation/v1" \
  -H "Authorization: Bearer ${OPENHANDS_API_KEY}"
```

### Ver Logs de una Automation

```bash
curl -X GET "${OPENHANDS_HOST}/api/automation/v1/{automation_id}/runs" \
  -H "Authorization: Bearer ${OPENHANDS_API_KEY}"
```

---

## 📊 Estados de Propuestas

La cola guarda las propuestas en memoria (`Map` en `ProposalQueue`), no en base
de datos: al reiniciar el proceso se pierden. Hasta que tenga almacén, este flujo
no puede prometerse como durable.

```
┌──────────────┐
│   PENDING    │ ◄── Generada, esperando tu aprobación
└──────┬───────┘
       │ aprobar
       ▼
┌──────────────┐
│   APPROVED   │ ◄── Aprobada, programada para publicación
└──────┬───────┘
       │ publicar
       ▼
┌──────────────┐
│  PUBLISHED   │ ◄── Ya publicada en la red social
└──────────────┘

┌──────────────┐
│   REJECTED   │ ◄── Rechazada por ti
└──────────────┘

┌──────────────┐
│   EXPIRED    │ ◄── Caducada sin acción (24h-365d según frecuencia)
└──────────────┘
```

---

## 🔄 Loops de Automatización

### Iniciar Loops Manualmente

`SocialAutomationLoops` sólo puede arrancarse dentro del servidor Express de
`backend/server.ts`, que no está desplegado: desde el repo, estas líneas no
tienen dónde correr.

```typescript
import { SocialAutomationLoops } from './backend/workflows/socialAutomationLoops';

// Inicializar y arrancar
SocialAutomationLoops.initialize();
SocialAutomationLoops.start();

// Ejecutar un ciclo específico ahora
await SocialAutomationLoops.runNow('daily');
await SocialAutomationLoops.runNow('weekly');
await SocialAutomationLoops.runNow('monthly');

// Ver estado
const status = SocialAutomationLoops.getStatus();
console.log(status);

// Detener todos
SocialAutomationLoops.stop();
```

### Configurar Frecuencia

```typescript
// Deshabilitar daily, habilitar yearly
SocialAutomationLoops.configure('daily', { enabled: false });
SocialAutomationLoops.configure('yearly', { enabled: true, autoApprove: false });

// Cambiar tono
SocialAutomationLoops.configure('weekly', { tone: 'casual' });

// Cambiar plataformas
SocialAutomationLoops.configure('daily', { platforms: ['twitter', 'telegram'] });
```

---

## 🛡️ Reporte de Seguridad

El reporte incluye:

```
🛡️ REPORTE DE SEGURIDAD
━━━━━━━━━━━━━━━━━━━━━━
📅 2026-08-05
📦 Repositorio: AiTor
🌿 Rama: main

RESUMEN:
🔴 Critical: 0
🟠 High: 2
🟡 Medium: 5
🟢 Low: 12
🔵 Info: 3

HALLAZGOS:
🟠 [HIGH] vulnerable-package@1.2.3
   📍 node_modules/vulnerable-package
   💡 Actualizar a versión 1.2.4

RECOMENDACIONES:
1. npm update vulnerable-package
2. Revisar changelog de actualizaciones

⏰ Próximo escaneo: 2026-08-06
```

---

## 📁 Estructura de Archivos

```
/workspace/project/AiTor/
├── backend/
│   ├── agents/
│   │   ├── socialMediaManager.ts    # 🆕 Gestor de redes sociales
│   │   ├── securityAgent.ts         # 🆕 Agente de seguridad
│   │   ├── supervisor.ts            # Actualizado con SOCIAL_MEDIA, SECURITY_SCAN
│   │   ├── orchestrator.ts         # Actualizado con nuevos handlers
│   │   ├── manus.ts
│   │   └── accio.ts
│   ├── workflows/
│   │   ├── socialProposalQueue.ts   # 🆕 Cola de propuestas
│   │   ├── socialAutomationLoops.ts # 🆕 Loops de automatización
│   │   └── monetizationLoop.ts
│   ├── rag/
│   │   ├── knowledge.ts
│   │   └── socialKnowledge.ts       # 🆕 RAG de redes sociales
│   ├── socialPublisher.ts           # 🆕 Publicador multi-plataforma
│   ├── memory/
│   └── server.ts
├── scripts/
│   └── setup-automations.sh        # 🆕 Script de configuración
├── .agents/
│   └── skills/
│       ├── social-media-manager.md  # 🆕
│       └── security-auditor.md     # 🆕
├── AGENTS.md                        # 🆕 Documentación de agentes
└── AUTOMATIONS.md                   # 🆕 Este archivo
```

---

## 🔧 Troubleshooting

### Error: "Social Media API not configured"

**Solución**: Añade las variables de entorno de la API correspondiente.

### Error: "Proposal not found"

**Solución**: Verifica el ID con `"ver propuestas"` y usa el ID exacto.

### Error: "npm audit failed"

**Solución**: Ejecuta manualmente `npm audit` en el directorio del proyecto.

### Automation no se ejecuta

**Solución**: 
1. Verifica que la automation esté activa: `curl .../api/automation/v1`
2. Check los logs: `curl .../api/automation/v1/{id}/runs`
3. Verifica el API key de OpenHands

---

## 📞 Soporte

Para soporte adicional:
- GitHub Issues: https://github.com/Alien69Flow/AiTor/issues
- Email: alien69flow@proton.me
- Telegram: @AlienFlowSpaceDAO

---

## 🔗 Links Útiles

- **AlienFlow.Space**: https://www.alienflow.space
- **Documentation**: https://alienflowspace.gitbook.io/DAO
- **GitHub Repo**: https://github.com/Alien69Flow/AiTor

---

*"Bless Financial Freedom for the Free Earth"*
**ΔlieπFlΦw $pac€ DAO | AiTor v.69**
