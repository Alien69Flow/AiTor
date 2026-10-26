import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, ExternalLink, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/hooks/useAuth";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { providerStateLabel, useProviderAvailability, type ProviderState } from "@/lib/auth-provider-status";
import {
  EFFORT_LABEL,
  EFFORT_TONE,
  PROVIDER_SETUP,
  SUPABASE_CALLBACK,
} from "@/lib/auth-provider-setup";

const LABEL: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  github: "GitHub",
  x: "X",
  discord: "Discord",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  twitch: "Twitch",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  slack: "Slack",
  spotify: "Spotify",
  notion: "Notion",
  figma: "Figma",
  zoom: "Zoom",
  kakao: "Kakao",
  wechat: "WeChat",
};

const STATE_TONE: Record<ProviderState, string> = {
  ready: "border-primary/40 bg-primary/15 text-primary",
  "missing-secret": "border-amber-400/45 bg-amber-400/10 text-amber-300",
  disabled: "border-border/50 bg-muted/20 text-muted-foreground/70",
  unknown: "border-border/50 bg-muted/20 text-muted-foreground/70",
};

const STATE_TEXT: Record<ProviderState, string> = {
  ready: "listo",
  "missing-secret": "sin credenciales",
  disabled: "no activado",
  unknown: "sin comprobar",
};

/** Order by what can be fixed fastest: broken-but-enabled first, then the easy wins. */
const EFFORT_ORDER = { sinRevision: 0, conRevision: 1, requiereCuenta: 2 } as const;
const STATE_ORDER: Record<ProviderState, number> = {
  "missing-secret": 0,
  ready: 1,
  unknown: 2,
  disabled: 3,
};

/** Project ref out of the URL, so the panel can link to the right dashboard. */
function projectRef(): string | null {
  const match = SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

/**
 * Every social method with its real status and the exact place where it is
 * fixed. A disabled button tells the visitor nothing about *why*, and the owner
 * should not have to read a doc to learn that Google needs a Client secret
 * while Apple needs a paid account. The callback URL is one value for all of
 * them, so it is copyable once at the top.
 */
export function AuthProvidersPanel() {
  const [open, setOpen] = useState(false);
  const target = typeof window !== "undefined" ? window.location.origin : "";
  const { states, checked, refresh } = useProviderAvailability(SOCIAL_PROVIDERS, target);
  const ref = projectRef();

  const ready = SOCIAL_PROVIDERS.filter((provider) => states[provider] === "ready").length;
  const missing = SOCIAL_PROVIDERS.filter((provider) => states[provider] === "missing-secret").length;

  const ordered = useMemo(() => {
    const stateOf = (provider: SocialProvider): ProviderState => states[provider] ?? "unknown";
    return [...SOCIAL_PROVIDERS].sort((a, b) => {
      const byState = STATE_ORDER[stateOf(a)] - STATE_ORDER[stateOf(b)];
      if (byState !== 0) return byState;
      return EFFORT_ORDER[PROVIDER_SETUP[a].effort] - EFFORT_ORDER[PROVIDER_SETUP[b].effort];
    });
    // `states` is replaced as a whole when the probe answers.
  }, [states]);

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="rounded-lg border border-border/35 bg-card/30">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
          Proveedores sociales
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/50">
          {checked ? `${ready} listos · ${missing} sin credenciales` : "comprobando…"}
        </span>
        {ready === 0 && checked && (
          <span className="font-mono text-[9px] text-amber-300/80">ningún botón social funciona todavía</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={refresh}
            disabled={!checked}
            title="Volver a preguntar a Supabase"
            className="inline-flex items-center gap-1 rounded border border-border/40 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-primary disabled:opacity-40"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${checked ? "" : "animate-spin"}`} />
            revisar
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded border border-primary/35 bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            {open ? "ocultar" : "cómo activarlos"}
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border/25 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5">
            <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
              URL de retorno (una para todos)
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-[9px] text-foreground/80">{SUPABASE_CALLBACK}</code>
            <button
              type="button"
              onClick={() => void copy(SUPABASE_CALLBACK, "Callback")}
              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase text-primary/70 hover:text-primary"
            >
              <Copy className="h-2.5 w-2.5" /> copiar
            </button>
            {ref && (
              <a
                href={`https://supabase.com/dashboard/project/${ref}/auth/providers`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[9px] uppercase text-primary/70 hover:text-primary"
              >
                abrir panel <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>

          <div className="divide-y divide-border/20">
            {ordered.map((provider) => {
              const state = states[provider] ?? "unknown";
              const setup = PROVIDER_SETUP[provider];
              const why = providerStateLabel(state);
              return (
                <div key={provider} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1.5">
                  <span className="w-20 shrink-0 font-heading text-[10px] uppercase tracking-wider text-foreground/85">
                    {LABEL[provider]}
                  </span>
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${STATE_TONE[state]}`}
                    title={why ? `${LABEL[provider]}: ${why}` : undefined}
                  >
                    {state === "ready" && <Check className="mr-0.5 inline h-2 w-2" />}
                    {STATE_TEXT[state]}
                  </span>
                  <span className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[8px] ${EFFORT_TONE[setup.effort]}`}>
                    {EFFORT_LABEL[setup.effort]}
                  </span>
                  <span className="min-w-0 flex-1 text-[9px] leading-4 text-muted-foreground/60">
                    <span className="text-foreground/70">{setup.console}</span> · {setup.need}
                  </span>
                  <code className="w-full truncate font-mono text-[8px] text-muted-foreground/40 sm:w-auto">
                    {setup.path}
                  </code>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[9px] leading-4 text-muted-foreground/55">
            El orden es el del esfuerzo real: arriba lo que se resuelve creando una app y pegando dos valores.
            «Con revisión» significa que el proveedor revisa la app antes de producción, y «requiere cuenta» que
            hace falta una cuenta de pago o verificación regional. Los estados los mide esta página contra
            Supabase, no son una lista fija: al guardar credenciales, pulsa <span className="text-primary/80">revisar</span>.
          </p>
        </div>
      )}
      {!checked && (
        <div className="flex items-center gap-2 border-t border-border/25 px-3 py-2 font-mono text-[9px] text-muted-foreground/50">
          <Loader2 className="h-3 w-3 animate-spin" /> midiendo proveedores…
        </div>
      )}
    </div>
  );
}
