/**
 * Por que fallo una llamada a la funcion `chat`, y como contarselo al usuario.
 *
 * Nace de un fallo real: durante dias el bot contesto "Mi nucleo cuantico esta
 * recalibrando frecuencias" por una clave invalida. El texto era amable y no
 * decia nada; el usuario no podia distinguir su mensaje de un despliegue roto.
 *
 * Se clasifica por el codigo y por el cuerpo, porque un 401 de Supabase y un
 * 401 del proveedor de IA se ven iguales desde fuera y se arreglan tocando
 * variables distintas.
 */

export type ChatFailureKind =
  /** El gateway de Supabase rechaza la clave con la que llamamos. */
  | "gateway-key"
  /** Supabase contesta que el proveedor de IA rechazo su clave. */
  | "provider-key"
  /** 401/403 sin pistas en el cuerpo. */
  | "auth"
  | "credits"
  | "not-found"
  | "rate-limit"
  | "server"
  /** No hubo respuesta: red, DNS o tiempo agotado. */
  | "network"
  | "other";

export interface ChatFailure {
  kind: ChatFailureKind;
  /** `null` cuando no hubo respuesta (red). */
  status: number | null;
  /** Recorte del cuerpo, ya sin credenciales. */
  snippet: string;
}

/**
 * Tapa cualquier credencial que se haya colado en un mensaje ajeno. El recorte
 * puede acabar delante de un usuario o en un log: ni un JWT ni una clave
 * publishable deben salir de ahi.
 */
export function scrubError(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[clave]")
    .replace(/sb_[a-z]+_[A-Za-z0-9_-]{8,}/g, "[clave]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function classifyChatFailure(status: number | null, rawBody = ""): ChatFailure {
  const snippet = scrubError(rawBody);
  const text = snippet.toLowerCase();

  if (status === null) return { kind: "network", status, snippet };

  if (status === 401 || status === 403) {
    if (
      text.includes("invalid api key") ||
      text.includes("no api key") ||
      text.includes("invalid jwt") ||
      text.includes("double check the provided api key")
    ) {
      return { kind: "gateway-key", status, snippet };
    }
    if (
      text.includes("provider authentication failed") ||
      text.includes("incorrect api key") ||
      text.includes("unauthorized")
    ) {
      return { kind: "provider-key", status, snippet };
    }
    return { kind: "auth", status, snippet };
  }

  if (status === 402) return { kind: "credits", status, snippet };
  if (status === 404) return { kind: "not-found", status, snippet };
  if (status === 429) return { kind: "rate-limit", status, snippet };
  if (status >= 500) return { kind: "server", status, snippet };
  return { kind: "other", status, snippet };
}

/**
 * El mismo fallo, contado para quien opera el despliegue.
 *
 * `chatFailureMessage` habla al usuario del bot; esto dice qué variable hay que
 * tocar y acompaña al `detail` de `/api/health`. Las dos lecturas salen de la
 * MISMA clasificación: antes había una copia en cada sitio y se desincronizaron.
 */
export function chatFailureDetail(failure: ChatFailure): string {
  const snippet = failure.snippet || "sin cuerpo";
  switch (failure.kind) {
    case "network":
      return "sin respuesta de chat (red caída o tiempo agotado)";
    case "gateway-key":
      return `HTTP ${failure.status}: Supabase rechaza la clave con la que se llama a chat (Invalid API key) — revisa VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY en Vercel`;
    case "provider-key":
      return `HTTP ${failure.status}: la clave del proveedor de IA fue rechazada (Provider authentication failed) — revisa LOVABLE_API_KEY en Supabase`;
    case "auth":
      return `HTTP ${failure.status}: chat rechaza la credencial y el cuerpo no dice cuál (${snippet})`;
    case "credits":
      return "HTTP 402: la clave del proveedor está sin créditos";
    case "not-found":
      return "HTTP 404: no existe la función chat en ese proyecto de Supabase";
    case "rate-limit":
      return "HTTP 429: límite de peticiones del proveedor";
    case "server":
      return `HTTP ${failure.status}: la función chat falló (${snippet})`;
    default:
      return `HTTP ${failure.status ?? "sin estado"}${failure.snippet ? `: ${failure.snippet}` : ""}`;
  }
}

/**
 * Lo que lee el usuario del bot. Sin jerga de despliegue y sin culparlo a el:
 * cada frase dice que pasa y si puede hacer algo.
 */
export function chatFailureMessage(failure: ChatFailure): string {
  switch (failure.kind) {
    case "network":
      return "📡 No hay conexión con el servicio de chat (red caída o sin respuesta a tiempo). Reintenta en un momento.";
    case "gateway-key":
      return "🔑 No puedo entrar en mi propia función de chat: la clave de Supabase configurada en el servidor no es válida (Invalid API key). No es tu mensaje — hay que corregir esa clave y vuelvo a responder.";
    case "provider-key":
      return "🔑 El proveedor de IA rechazó la clave del bot (Provider authentication failed). No es tu mensaje: hasta que esa clave se renueve no puedo generar respuestas.";
    case "auth":
      return `🔑 La función de chat rechaza la credencial del servidor (HTTP ${failure.status}). Es un fallo de configuración, no de tu mensaje.`;
    case "credits":
      return "💳 La clave del proveedor de IA se quedó sin créditos. No puedo generar respuestas hasta que se recargue.";
    case "not-found":
      return "🧭 La función de chat no existe en ese proyecto de Supabase. Es un fallo de despliegue, no de tu mensaje.";
    case "rate-limit":
      return "⏳ Demasiadas peticiones ahora mismo. Espera unos segundos y repite.";
    case "server":
      return `⚠️ La función de chat está fallando (HTTP ${failure.status}). Reintenta en un momento.`;
    default:
      return `⚠️ No pude completar la respuesta (HTTP ${failure.status ?? "sin estado"}). Reintenta en un momento.`;
  }
}
