# Agent Runtime Foundation

Este directorio contiene el núcleo controlado para ejecutar agentes, skills y workflows.

## Principios

- Los agentes planifican; las herramientas ejecutan.
- Ninguna herramienta desconocida se puede ejecutar.
- Las herramientas de riesgo alto/crítico quedan bloqueadas hasta aprobación.
- Cada ejecución tiene identidad, límite de pasos, reintentos acotados, timeout e idempotencia.
- El runtime no depende de un proveedor concreto de modelos.
- Las acciones deben auditarse mediante `AuditSink`.

## Integración actual

El runtime se integra con las rutas existentes del Supervisor mediante capacidades explícitas:

- `TASK_MANUS` -> `development`
- `SECURITY_SCAN` -> `security`
- generación de `SOCIAL_MEDIA` -> `social`

Los adapters reutilizan los agentes existentes. La capacidad de desarrollo ejecuta Manus y usa Accio como fallback; no añade escritura arbitraria de repositorios ni shell libre.

La capacidad social genera propuestas y las deja en la cola existente para aprobación humana. No publica directamente en redes sociales.

## Controles

- Máximo de pasos configurable y acotado.
- Máximo de reintentos configurable y acotado.
- El riesgo registrado de una herramienta no puede ser reducido por el plan.
- Las herramientas de riesgo alto/crítico requieren aprobación explícita.
- Las herramientas no reintentables pueden evitar duplicación de efectos parciales.
- Las ejecuciones se identifican mediante `runId` y `actorId`.

## Pendiente antes de acciones externas

1. Pasar una identidad autenticada como `actorId`.
2. Persistir auditoría y estado de ejecución.
3. Añadir persistencia/resume para workflows que quedan en `waiting_approval`.
4. Añadir adapters sandboxed para cualquier futura escritura de repositorio, shell o publicación externa.

Esta PR se limita a la capa de orquestación controlada y no habilita acceso irrestricto a producción.
