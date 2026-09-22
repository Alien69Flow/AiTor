# Agent Runtime Foundation

Este directorio contiene el núcleo controlado para ejecutar agentes, skills y workflows.

## Principios

- Los agentes planifican; las herramientas ejecutan.
- Ninguna herramienta desconocida se puede ejecutar.
- Las herramientas de riesgo alto/crítico quedan bloqueadas hasta aprobación.
- Cada ejecución tiene identidad, límite de pasos, timeout e idempotencia.
- El runtime no depende de un proveedor concreto de modelos.
- Las acciones deben auditarse mediante `AuditSink`.

## Integración mínima

1. Registrar herramientas concretas en `ToolRegistry`.
2. Implementar un `Planner` que produzca `WorkflowPlan` validado.
3. Crear `WorkflowEngine` con el nivel de riesgo permitido.
4. Pasar una identidad autenticada como `actorId`.
5. Persistir auditoría y estados antes de habilitar acciones externas.

Esta primera versión no ejecuta shell, no escribe repositorios y no publica en redes sociales. Esos adapters deben añadirse después con sandbox, permisos mínimos y aprobación humana.
