# Security Auditor Agent

## Descripción
Agente especializado en auditoría de seguridad del repositorio AiTor y AlienFlowSpace DAO.

> **No programado:** `backend/agents/securityAgent.ts` sabe ejecutar `npm audit`,
> pero nada lo dispara a diario ni semanalmente. Ver
> [ROADMAP.md](../../ROADMAP.md).

## Escaneos Disponibles

### Escaneo Rápido
```bash
"escaneo rápido" o "npm audit"
```
Ejecuta solo `npm audit` para verificar vulnerabilidades en dependencias.

### Escaneo Completo
```bash
"escaneo completo" o "full scan"
```
Ejecuta:
- npm audit (vulnerabilidades)
- npm outdated (dependencias obsoletas)
- Busqueda de secretos hardcoded
- Revision de package.json

## Reporte Generado

```typescript
interface SecurityReport {
  timestamp: Date;
  repository: string;
  branch: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: SecurityFinding[];
  recommendations: string[];
}
```

## Niveles de Severidad
- 🔴 **Critical**: Requiere atención inmediata
- 🟠 **High**: Actualizar urgentemente
- 🟡 **Medium**: Actualizar pronto
- 🟢 **Low**: Considerar actualizar
- 🔵 **Info**: Informativo

## Integración con OpenHands

### Cron Diarios
```json
{
  "name": "Daily Security Scan",
  "trigger": {"type": "cron", "schedule": "0 8 * * *"},
  "prompt": "Ejecuta escaneo rápido de seguridad del repo AiTor y reporta hallazgos críticos"
}
```

### Cron Semanales
```json
{
  "name": "Weekly Security Audit",
  "trigger": {"type": "cron", "schedule": "0 9 * * 1"},
  "prompt": "Ejecuta escaneo completo de seguridad y genera reporte detallado"
}
```

## Acciones Automáticas
- Notificar hallazgos críticos via Telegram
- Crear issues en GitHub para vulnerabilidades
- Sugerir updates de dependencias
