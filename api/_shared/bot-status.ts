/**
 * Lo que contesta `/estado`, sin adornos.
 *
 * Sólo hechos que este proceso puede mirar: si el webhook exige firma, si hay
 * memoria y cuántos mensajes guarda, cuántas alertas tiene el chat, si los
 * reintentos de Telegram se deduplican y cuánto conocimiento fundacional hay
 * cargado. Nada de latencias inventadas ni de «todo en verde» sin comprobarlo:
 * lo que no se puede leer se dice como no disponible.
 */

export interface BotStatus {
  /** Secreto compartido con Telegram configurado y válido. */
  signed: boolean;
  memory: { configured: boolean; messages: number | null };
  alerts: { configured: boolean; count: number | null; max: number };
  /** Redis o Supabase: sin esto, un reintento de Telegram puede contestar dos veces. */
  dedupe: boolean;
  knowledgeBlocks: number;
  /** Tipo de clave de Supabase en uso (`jwt` o `publishable`), nunca su valor. */
  supabaseKeyKind: string;
  /** Tope diario de respuestas del modelo en este chat. */
  budget: { used: number; limit: number; storage: "redis" | "memory" };
}

const OK = "✅";
const WARN = "⚠️";

function statusLine(label: string, value: string): string {
  return `<b>${label}</b>: ${value}`;
}

export function formatStatus(status: BotStatus): string {
  const signed = status.signed
    ? `${OK} firmado con <code>secret_token</code>`
    : `${WARN} sin secreto: acepta actualizaciones sin firmar (con cuota por IP)`;

  const memory = !status.memory.configured
    ? `${WARN} sin Redis: cada mensaje empieza de cero`
    : status.memory.messages === null
      ? `${OK} activa, hilo sin mensajes todavía`
      : `${OK} ${status.memory.messages} mensaje(s) guardados en este hilo`;

  const alerts = !status.alerts.configured
    ? `${WARN} sin almacén (falta Redis): no puedo guardar avisos`
    : status.alerts.count === null
      ? `${OK} almacén listo, 0 de ${status.alerts.max}`
      : `${OK} ${status.alerts.count} de ${status.alerts.max} en este chat`;

  const dedupe = status.dedupe
    ? `${OK} activo: un reintento de Telegram no se contesta dos veces`
    : `${WARN} inactivo: un reintento puede duplicar la respuesta (y la cuota)`;

  const knowledge = `${OK} ${status.knowledgeBlocks} bloque(s) fundacionales`;

  // El tope cuenta turnos del modelo: con Redis es exacto entre invocaciones;
  // sin Redis es sólo de esta instancia y hay que decirlo, no maquillarlo.
  const budget =
    status.budget.storage === "redis"
      ? `${OK} ${status.budget.used} de ${status.budget.limit} respuestas hoy (exacto, Redis)`
      : `${WARN} ${status.budget.used} de ${status.budget.limit} en esta instancia: sin Redis el tope no es exacto`;

  return [
    "🛰 <b>Estado del bot</b>",
    "",
    statusLine("Webhook", signed),
    statusLine("Memoria del hilo", memory),
    statusLine("Alertas", alerts),
    statusLine("Dedupe", dedupe),
    statusLine("Conocimiento", knowledge),
    statusLine("Gasto del chat", budget),
    statusLine("Clave de Supabase", `<code>${status.supabaseKeyKind}</code>`),
    "",
    "Esto es lo que veo desde este despliegue; lo marcado como aviso no está disponible, y el comando sigue respondiendo sin esa pieza.",
  ].join("\n");
}
