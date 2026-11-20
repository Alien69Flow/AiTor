# Social Media Manager Agent

## Descripción
Skill especializado para la gestión automatizada de redes sociales de AlienFlowSpace DAO. Genera propuestas de contenido, las presenta para aprobación y ejecuta tras confirmación.

> **No desplegado:** el agente y el publicador existen en `backend/` y nada los
> arranca. Los comandos de abajo son el diseño, no algo que responda en el bot;
> ver [ROADMAP.md](../../ROADMAP.md) fases 9–10.

## Funcionalidades

### Generación de Contenido
- **Diario**: Genera 3-5 posts listos para publicar
- **Semanal**: Calendario visual con 7-14 posts
- **Mensual**: Estrategia de contenido + temas principales
- **Trimestral**: Documento estratégico de 3 meses
- **Anual**: Plan maestro de comunicaciones

### Plataformas Soportadas
- Twitter/X, LinkedIn, Instagram, Facebook, Discord, Telegram, FarcaSter, GitHub, HackMD, DoraHacks

## Comandos
- `"genera posts diarios"` - Genera posts para hoy
- `"crea contenido semanal"` - Genera calendario semanal
- `"ver propuestas"` - Lista propuestas pendientes
- `"aprobar [id]"` - Aprueba propuesta específica
- `"estadísticas"` - Muestra stats del sistema

## Workflow
```
Generar → Presentar → Aprobar → Programar → Publicar
```
