/**
 * Qué credencial necesita cada proveedor de IA del chat, en un solo sitio.
 *
 * Antes las listas de modelos vivían repartidas por `chat/index.ts` y el
 * catálogo de la UI (`src/lib/ai-models.ts`) decía "disponible: true" para
 * oráculos que nunca podían responder porque su clave no existía. El resultado
 * era un selector que ofrecía modelos muertos y un error 500 al elegirlos.
 *
 * Este módulo es la fuente de verdad para el servidor: qué variable de entorno
 * abre cada proveedor y qué modelos sirve. `GET chat?health=1` lo publica — sin
 * valores, solo si la clave existe y si parece real — y la UI desactiva lo que
 * no tiene credencial en vez de esconderlo.
 *
 * Sin APIs de Deno a propósito: recibe el entorno como función para poder
 * probarse con un objeto cualquiera.
 */

export type ProviderId = "lovable" | "xai" | "anthropic" | "deepseek";

/** `missing` = no hay variable; `placeholder` = hay algo que no es una clave. */
export type KeyState = "ok" | "missing" | "placeholder";

export type ModelSignal = "ready" | "missing-key" | "placeholder-key";

export interface ProviderSpec {
  id: ProviderId;
  /** Nombre para la UI. */
  label: string;
  /** Variable de entorno que hay que rellenar. */
  envVar: string;
  /** Dónde se rellena, para que el aviso sea accionable. */
  where: string;
  /** Modelos que atiende este proveedor (ids compartidos con la UI). */
  models: readonly string[];
}

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** Gateway de Lovable/Gemini: el único que también sirve de red de seguridad. */
export const FALLBACK_MODEL = DEFAULT_MODEL;

export const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: "lovable",
    label: "Lovable AI",
    envVar: "LOVABLE_API_KEY",
    where: "Supabase → Edge Functions → Secrets → LOVABLE_API_KEY",
    models: [
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
    ],
  },
  {
    id: "xai",
    label: "xAI",
    envVar: "GROK_API_KEY",
    where: "Supabase → Edge Functions → Secrets → GROK_API_KEY",
    models: ["xai/grok-2"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    where: "Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY",
    models: ["anthropic/claude-sonnet-4"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    where: "Supabase → Edge Functions → Secrets → DEEPSEEK_API_KEY",
    models: ["deepseek/deepseek-v3", "deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
  },
];

/**
 * Valores que se pegan en una variable y no son una clave: el marcador del
 * `.env.example`, el "cámbialo" de un tutorial, o un nombre en vez del valor.
 * Detectarlos evita ofrecer un modelo que responderá 401.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^(changeme|change[-_]me|placeholder|replace[-_]?me|todo|tbd|dummy|sample|example|test|secret|api[-_]?key|none|null|undefined|false|true)$/i,
  /^(your|my|tu|mi|insert)[-_ ]/i,
  /^(sk|pk|key)[-_](your|xxx|test|placeholder|dummy|change)/i,
  /^<.*>$/,
  /^\$\{.*\}$/,
  /^x{4,}$/i,
  /^(.)\1{9,}$/i,
];

/** Un valor corto o con espacios no es una clave de API. */
const MIN_KEY_LENGTH = 16;

export function keyState(raw: string | null | undefined): KeyState {
  const value = (raw ?? "").trim();
  if (!value) return "missing";
  if (value.length < MIN_KEY_LENGTH) return "placeholder";
  if (/\s/.test(value)) return "placeholder";
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) return "placeholder";
  return "ok";
}

export function getProvider(id: ProviderId): ProviderSpec {
  const provider = PROVIDERS.find((entry) => entry.id === id);
  if (!provider) throw new Error(`Proveedor desconocido: ${id}`);
  return provider;
}

export function modelsForProvider(id: ProviderId): readonly string[] {
  return getProvider(id).models;
}

/** Todos los modelos que alguna función sabría enrutar. */
export const ROUTED_MODELS: readonly string[] = PROVIDERS.flatMap((provider) => provider.models);

export function providerForModel(model: string): ProviderSpec | null {
  return PROVIDERS.find((provider) => provider.models.includes(model)) ?? null;
}

export interface ProviderHealth {
  id: ProviderId;
  label: string;
  envVar: string;
  where: string;
  keyState: KeyState;
  /** Solo `true` con una clave que parece real; nunca el valor. */
  configured: boolean;
  models: string[];
}

export interface ModelHealth {
  id: string;
  provider: ProviderId;
  available: boolean;
  reason: ModelSignal;
  /** Sólo en el informe con `probe=1`: lo que pasó al llamar de verdad. */
  probe?: OracleProbe;
}

export interface ChatHealth {
  service: "chat";
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  providers: ProviderHealth[];
  models: ModelHealth[];
  defaultModel: string;
  fallbackModel: string;
  /** Presente sólo con `probe=1`: llamada mínima real a cada oráculo. */
  probe?: { at: string; ok: number; total: number };
}

/**
 * `ok`     el proveedor por defecto responde
 * `degraded` algún proveedor responde, pero el por defecto no
 * `down`   ninguno tiene clave: el chat no puede contestar
 */
function overallStatus(providers: ProviderHealth[]): ChatHealth["status"] {
  const ready = new Set(providers.filter((provider) => provider.configured).map((provider) => provider.id));
  if (ready.has("lovable")) return "ok";
  return ready.size > 0 ? "degraded" : "down";
}

/**
 * Informe sin secretos: del valor solo se deriva si existe y si parece real.
 * `env` se inyecta para poder probar el informe sin Deno.
 */
export function buildChatHealth(
  env: (name: string) => string | undefined,
  now: Date = new Date(),
): ChatHealth {
  const providers: ProviderHealth[] = PROVIDERS.map((provider) => {
    const state = keyState(env(provider.envVar));
    return {
      id: provider.id,
      label: provider.label,
      envVar: provider.envVar,
      where: provider.where,
      keyState: state,
      configured: state === "ok",
      models: [...provider.models],
    };
  });

  const models: ModelHealth[] = providers.flatMap((provider) =>
    provider.models.map((id) => ({
      id,
      provider: provider.id,
      available: provider.configured,
      reason: provider.configured
        ? ("ready" as const)
        : provider.keyState === "missing"
          ? ("missing-key" as const)
          : ("placeholder-key" as const),
    })),
  );

  return {
    service: "chat",
    status: overallStatus(providers),
    checkedAt: now.toISOString(),
    providers,
    models,
    defaultModel: DEFAULT_MODEL,
    fallbackModel: FALLBACK_MODEL,
  };
}

/**
 * Resultado de llamar de verdad a un oráculo con el mensaje más corto posible.
 *
 * Mirar la clave sólo dice que hay algo parecido a una clave: una clave
 * revocada, un proveedor caído o un modelo retirado pasaban el chequeo y
 * fallaban en la primera pregunta real. Esta sonda usa la **misma ruta** que
 * atiende el chat, así que comprueba el camino completo.
 */
export interface OracleProbe {
  model: string;
  provider: ProviderId;
  ok: boolean;
  /** Código HTTP, o `null` si ni hubo respuesta (red, tiempo agotado). */
  status: number | null;
  ms: number;
  /** Motivo recortado y sin credenciales. */
  error?: string;
}

/** Lo que el handler inyecta: la llamada real, para poder probar sin red. */
export type OracleProbeCall = (model: string) => Promise<{ ok: boolean; status: number }>;

/** Texto de la llamada mínima: una palabra, para no gastar cuota. */
export const PROBE_MESSAGE = "ping";

/**
 * Quita del mensaje de error cualquier cosa con pinta de credencial: una URL
 * con `?key=` o un `Bearer` acabarían en los logs del monitor.
 */
function safeError(error: unknown, status: number | null): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const sinClaves = raw
    .replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***");
  if (sinClaves) return sinClaves.slice(0, 120);
  return status === null ? "sin respuesta" : `HTTP ${status}`;
}

/**
 * Sondea cada modelo de cada proveedor con clave válida.
 *
 * Va en paralelo y con tope de tiempo por llamada: un proveedor colgado no
 * puede dejar el informe sin respuesta.
 */
export async function probeOracles(
  env: (name: string) => string | undefined,
  call: OracleProbeCall,
  options: { timeoutMs?: number; now?: () => number; models?: readonly string[] } = {},
): Promise<OracleProbe[]> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const now = options.now ?? (() => Date.now());
  const wanted = options.models ? new Set(options.models) : null;

  const targets = PROVIDERS.filter((provider) => keyState(env(provider.envVar)) === "ok").flatMap(
    (provider) =>
      provider.models
        .filter((model) => !wanted || wanted.has(model))
        .map((model) => ({ provider: provider.id, model })),
  );

  return Promise.all(
    targets.map(async ({ provider, model }) => {
      const started = now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          call(model),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`tiempo agotado (${timeoutMs} ms)`)), timeoutMs);
          }),
        ]);
        return {
          model,
          provider,
          ok: result.ok,
          status: result.status,
          ms: now() - started,
          ...(result.ok ? {} : { error: safeError(null, result.status) }),
        };
      } catch (error) {
        return {
          model,
          provider,
          ok: false,
          status: null,
          ms: now() - started,
          error: safeError(error, null),
        };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }),
  );
}

/**
 * Mete el resultado de las sondas en el informe: cada modelo lleva la suya y
 * el resumen dice cuántos respondieron.
 */
export function attachProbes(health: ChatHealth, probes: OracleProbe[], now: Date = new Date()): ChatHealth {
  const byModel = new Map(probes.map((probe) => [probe.model, probe]));
  return {
    ...health,
    models: health.models.map((model) => {
      const probe = byModel.get(model.id);
      return probe ? { ...model, probe } : model;
    }),
    probe: { at: now.toISOString(), ok: probes.filter((probe) => probe.ok).length, total: probes.length },
  };
}
