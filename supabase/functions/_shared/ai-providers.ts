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
}

export interface ChatHealth {
  service: "chat";
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  providers: ProviderHealth[];
  models: ModelHealth[];
  defaultModel: string;
  fallbackModel: string;
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
