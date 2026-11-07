import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Fingerprint, Loader2, Mail, Lock, LockKeyhole, Phone, RotateCw, Wallet, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth, SOCIAL_PROVIDERS, type SocialProvider } from "@/hooks/useAuth";
import { providerStateLabel, useProviderAvailability } from "@/lib/auth-provider-status";
import { turnstileToken } from "@/lib/turnstile";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { track } from "@/lib/analytics";
import {
  AppleIcon,
  BitbucketIcon,
  DiscordIcon,
  FacebookIcon,
  FigmaIcon,
  GitHubIcon,
  GitLabIcon,
  GoogleIcon,
  KakaoIcon,
  LinkedInIcon,
  MicrosoftIcon,
  NotionIcon,
  RedditIcon,
  SlackIcon,
  SpotifyIcon,
  TwitchIcon,
  WeChatIcon,
  XIcon,
  ZoomIcon,
} from "./BrandIcons";

const PROVIDER_LABEL: Record<SocialProvider, string> = {
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

const PROVIDER_ICON: Record<SocialProvider, (props: { className?: string }) => JSX.Element> = {
  google: GoogleIcon,
  apple: AppleIcon,
  microsoft: MicrosoftIcon,
  github: GitHubIcon,
  x: XIcon,
  discord: DiscordIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  reddit: RedditIcon,
  twitch: TwitchIcon,
  gitlab: GitLabIcon,
  bitbucket: BitbucketIcon,
  slack: SlackIcon,
  spotify: SpotifyIcon,
  notion: NotionIcon,
  figma: FigmaIcon,
  zoom: ZoomIcon,
  kakao: KakaoIcon,
  wechat: WeChatIcon,
};

/** Where to enable each provider in the Supabase dashboard, for the toast. */
/**
 * Ways in that need no social provider at all: Supabase backs the four of them
 * from the same Auth service, so they share one form and one verification step.
 * `password` and `magic` need nothing new in Supabase; `code` and `phone` send
 * a six-digit token, and the SMS one needs a configured provider.
 */
type DirectMode = "password" | "magic" | "code" | "phone";

/** Human name for every provider Supabase can report as linked to an account. */
const IDENTITY_LABEL: Record<string, string> = {
  email: "email",
  phone: "teléfono",
  siwe: "wallet",
  passkey: "passkey",
  google: "Google",
  apple: "Apple",
  azure: "Microsoft",
  github: "GitHub",
  x: "X",
  discord: "Discord",
  facebook: "Facebook",
  linkedin_oidc: "LinkedIn",
  "custom:reddit": "Reddit",
  "custom:wechat": "WeChat",
  twitch: "Twitch",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  slack_oidc: "Slack",
  spotify: "Spotify",
  notion: "Notion",
  figma: "Figma",
  zoom: "Zoom",
  kakao: "Kakao",
};

const DIRECT_MODES: { id: DirectMode; label: string }[] = [
  { id: "password", label: "Clave" },
  { id: "magic", label: "Enlace" },
  { id: "code", label: "Código" },
  { id: "phone", label: "SMS" },
];

const ENABLE_AT: Partial<Record<SocialProvider, string>> = {
  reddit: "Authentication → Providers → Custom Providers → custom:reddit",
  wechat: "Authentication → Providers → Custom Providers → custom:wechat",
};

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

interface AuthMethodsProps {
  /** Where the OAuth callback should land. Defaults to the current origin. */
  redirectTo?: string;
  /** Renders the email + password form under the social buttons. */
  showEmailForm?: boolean;
  /** Two columns on wide cards, four on the full page. */
  columns?: 2 | 4;
  onSignedIn?: () => void;
  className?: string;
}

/**
 * Single implementation of every way into the account: the OAuth providers
 * Supabase supports (Google, Apple, Microsoft, GitHub, X, Discord, Facebook,
 * LinkedIn, Reddit, Twitch, GitLab, Bitbucket, Slack, Spotify, Notion, Figma,
 * Zoom, Kakao, WeChat), a Reown wallet signature (SIWE), a passkey (WebAuthn,
 * also offered through the browser's autofill), and the four direct modes that
 * need no provider: password, magic link, the six-digit email code and the SMS
 * code. The session bar lists the identities actually linked to the account. Meta
 * offers no "sign in with Instagram", so Instagram is not offered at all.
 * The auth page and the System → DAO panel both render this component, so a
 * method can never work in one place and be dead in the other.
 */
export function AuthMethods({
  redirectTo,
  showEmailForm = true,
  columns = 2,
  onSignedIn,
  className = "",
}: AuthMethodsProps) {
  const {
    user,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
    sendEmailOtp,
    verifyEmailCode,
    sendPhoneCode,
    verifyPhoneCode,
    signInWithPasskey,
    registerPasskey,
  } = useAuth();
  const {
    signIn: walletSignIn,
    busy: walletBusy,
    error: walletError,
    isConnected: walletConnected,
    address: walletAddress,
  } = useWalletAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<SocialProvider | "email" | "passkey" | null>(null);
  const [directMode, setDirectMode] = useState<DirectMode>("password");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  /** Which destination already got a link or a code, so the form knows. */
  const [sentTo, setSentTo] = useState<"email" | "phone" | null>(null);
  /** Segundos que faltan para poder reenviar el enlace (límite de Supabase). */
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  const target = redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  // A provider can be switched on in /auth/v1/settings and still have no Client
  // ID + Secret, which turns its button into a dead end. This asks the same
  // endpoint the button uses, so the page can say so before the click.
  const { states: providerStates, checked: providersChecked, refresh: refreshProviders } =
    useProviderAvailability(SOCIAL_PROVIDERS, target ?? "");
  const configuredCount = SOCIAL_PROVIDERS.filter((provider) => providerStates[provider] === "ready").length;
  const missingSecretCount = SOCIAL_PROVIDERS.filter(
    (provider) => providerStates[provider] === "missing-secret",
  ).length;
  const disabledCount = SOCIAL_PROVIDERS.filter(
    (provider) => providerStates[provider] === "disabled",
  ).length;
  /**
   * Providers that were never switched on are collapsed behind one line:
   * seventeen locked buttons pushed the form past the fold on a laptop. What is
   * enabled (even when it is broken), what works and what could not be checked
   * are always rendered, so a provider never disappears by being unverified —
   * and the amber lock stays in sight until the credentials are saved.
   */
  const [showDisabledProviders, setShowDisabledProviders] = useState(false);
  const visibleProviders = SOCIAL_PROVIDERS.filter(
    (provider) => showDisabledProviders || providerStates[provider] !== "disabled",
  );
  const deadCount = SOCIAL_PROVIDERS.filter((provider) => {
    const state = providerStates[provider];
    return state === "missing-secret" || state === "disabled";
  }).length;

  // Un solo temporizador por cuenta atrás: el reenvío se bloquea 30 s para no
  // chocar con el rate limit de envíos de Supabase, que es por usuario y por hora.
  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const id = window.setInterval(() => setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooling]);

  /** Providers actually linked to this account, so the session bar tells the truth. */
  const linkedIdentities = useMemo(() => {
    if (!user) return [];
    const providers = new Set<string>();
    for (const identity of user.identities ?? []) providers.add(identity.provider);
    if (user.email) providers.add("email");
    if (user.phone) providers.add("phone");
    return [...providers];
  }, [user]);

  /**
   * WebAuthn Conditional UI: while the visitor sits on the form the browser
   * offers their passkey through the email field's autofill. The challenge is
   * only fetched when the device really has a usable authenticator, and every
   * rejection caused by the visitor ignoring the prompt is swallowed — that is
   * the expected path, not an error worth a toast.
   */
  useEffect(() => {
    if (user) return;
    const webauthn = window.PublicKeyCredential;
    if (typeof webauthn?.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return;

    let cancelled = false;
    webauthn
      .isUserVerifyingPlatformAuthenticatorAvailable()
      .then((available) => {
        if (!available || cancelled) return;
        return signInWithPasskey({ options: { mediation: "conditional" } }).then(({ error }) => {
          if (!cancelled && error && !/abort|not allowed|no passkey|not found|timeout/i.test(error.message)) {
            console.warn("[auth] passkey autofill:", error.message);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user, signInWithPasskey]);

  const submitLabel =
    directMode === "password"
      ? isLogin ? "Acceder al Nexo" : "Crear Identidad"
      : directMode === "magic"
        ? sentTo ? "Reenviar enlace" : "Enviar enlace mágico"
        : sentTo
          ? "Verificar y entrar"
          : directMode === "phone" ? "Enviar código SMS" : "Enviar código";
  const gridClass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2";

  const handleProvider = async (provider: SocialProvider) => {
    setPending(provider);
    try {
      track("signup_started", { method: provider });
      const { error } = await signInWithProvider(provider, target);
      if (error) {
        const raw = error.message || `Error con ${PROVIDER_LABEL[provider]}`;
        const where = ENABLE_AT[provider] ?? "Authentication → Providers";
        toast.error(
          /missing oauth secret/i.test(raw)
            ? `Faltan las credenciales de ${PROVIDER_LABEL[provider]} en Supabase (${where}: Client ID + Secret).`
            : /not enabled|unsupported|provider .* not found/i.test(raw)
              ? `${PROVIDER_LABEL[provider]} no está activado en Supabase (${where}).`
              : raw,
        );
      }
    } finally {
      setPending(null);
    }
  };

  /** Supabase's raw wording, translated to the panel where the feature lives. */
  const otpHint = (raw: string, channel: "email" | "phone") => {
    // Supabase answers "Unable to get SMS provider" (sin proveedor conectado),
    // "Email logins are disabled" y "provider is not enabled", entre otras.
    const missing = channel === "phone"
      ? /provider|unable|not enabled|not supported|disabled/i
      : /not enabled|not supported|disabled/i;
    if (!missing.test(raw)) return raw;
    return channel === "phone"
      ? "El teléfono no está activado: conecta un proveedor SMS (Twilio, MessageBird o Vonage) en Supabase → Authentication → Phone."
      : "El acceso por email no está activado en Supabase → Authentication → Email.";
  };

  /** El límite de envíos de Supabase, traducido; el resto, como siempre. */
  const magicHint = (raw: string) => {
    if (/rate limit|too many|for security purposes|only request this after/i.test(raw)) {
      return "Demasiadas peticiones seguidas: espera un minuto y reintenta. Supabase limita los envíos de email por usuario (Authentication → Rate Limits).";
    }
    return otpHint(raw, "email");
  };

  /**
   * Un único envío para el enlace mágico, compartido por el formulario y por el
   * reenvío de la tarjeta de enviado: así la cuenta atrás y el mensaje de error
   * no pueden divergir entre los dos botones.
   */
  const sendMagicLink = async (address: string) => {
    const { error } = await sendEmailOtp(address, target, (await turnstileToken()) ?? undefined);
    if (error) {
      toast.error(magicHint(error.message));
      return false;
    }
    setSentTo("email");
    setCooldown(30);
    toast.success(`Abre el enlace de acceso que te hemos enviado a ${address}.`);
    return true;
  };

  const handleResendMagic = async () => {
    setPending("email");
    try {
      await sendMagicLink(email);
    } finally {
      setPending(null);
    }
  };

  /** Entrada directa al respaldo: elige el modo y deja el cursor en el email. */
  const startMagic = () => {
    setDirectMode("magic");
    setSentTo(null);
    setCooldown(0);
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  const changeEmail = () => {
    setSentTo(null);
    setCooldown(0);
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();

    if (directMode === "password") {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
      setPending("email");
      try {
        // Turnstile solo protege lo que cuesta dinero servir: el registro y
        // cada envío de código. Iniciar sesión con clave no envía nada.
        const captcha = isLogin ? undefined : (await turnstileToken()) ?? undefined;
        if (isLogin) {
          const { error } = await signIn(email, password, captcha);
          if (error) {
            toast.error(error.message.includes("Invalid login credentials") ? "Credenciales incorrectas" : error.message);
          } else {
            toast.success("¡Bienvenido, Soberano!");
            onSignedIn?.();
          }
        } else {
          const { error } = await signUp(email, password, target, captcha);
          if (error) {
            toast.error(error.message.includes("already registered") ? "Este email ya está registrado" : error.message);
          } else {
            track("signup_completed", { method: "email" });
            toast.success("Cuenta creada. Revisa tu email para confirmarla.");
          }
        }
      } finally {
        setPending(null);
      }
      return;
    }

    setPending("email");
    try {
      if (directMode === "magic") {
        const check = authSchema.shape.email.safeParse(email);
        if (!check.success) {
          toast.error(check.error.errors[0].message);
          return;
        }
        if (await sendMagicLink(email)) track("signup_started", { method: "magic_link" });
        return;
      }

      // Two steps for the code modes: first send, then verify the six digits.
      if (!sentTo) {
        const byPhone = directMode === "phone";
        const captcha = (await turnstileToken()) ?? undefined;
        const { error } = byPhone
          ? await sendPhoneCode(phone, captcha)
          : await sendEmailOtp(email, target, captcha);
        if (error) {
          toast.error(otpHint(error.message, byPhone ? "phone" : "email"));
          return;
        }
        setSentTo(byPhone ? "phone" : "email");
        toast.success(byPhone ? `Código SMS enviado a ${phone}.` : `Código de 6 dígitos enviado a ${email}.`);
        return;
      }

      const { error = null } =
        sentTo === "phone"
          ? await verifyPhoneCode(phone, code)
          : await verifyEmailCode(email, code);
      if (error) {
        toast.error(error.message);
        return;
      }
      track("signup_completed", { method: sentTo === "phone" ? "phone" : "email_code" });
      toast.success("¡Bienvenido, Soberano!");
      onSignedIn?.();
    } finally {
      setPending(null);
    }
  };

  const handlePasskey = async () => {
    setPending("passkey");
    try {
      track("signup_started", { method: "passkey" });
      const { error } = await signInWithPasskey({ options: { captchaToken: (await turnstileToken()) ?? undefined } });
      if (error) {
        const raw = error.message || "No se pudo usar la passkey";
        toast.error(
          /not enabled|disabled|not found|no passkey/i.test(raw)
            ? "Passkeys sin configurar: actívalas en Supabase → Authentication → Sign In → Passkeys y guarda una desde tu cuenta."
            : raw,
        );
        return;
      }
      toast.success("Passkey verificada. ¡Bienvenido, Soberano!");
      onSignedIn?.();
    } finally {
      setPending(null);
    }
  };

  const handleAddPasskey = async () => {
    setPending("passkey");
    try {
      const { error } = await registerPasskey();
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Passkey añadida. La próxima vez entras con huella o Face ID.");
    } finally {
      setPending(null);
    }
  };

  const handleWallet = async () => {
    const ok = await walletSignIn();
    if (ok) {
      toast.success("Wallet verificada. ¡Bienvenido, Soberano!");
      onSignedIn?.();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {user ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/85">
            {user.email ?? user.id}
          </span>
          {linkedIdentities.length > 0 && (
            <span className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[9px] text-muted-foreground/70">
              {linkedIdentities.map((provider) => (
                <span
                  key={provider}
                  className="border border-border/40 px-1 py-0.5 uppercase tracking-wider"
                  title={`Identidad enlazada: ${provider}`}
                >
                  {IDENTITY_LABEL[provider] ?? provider}
                </span>
              ))}
            </span>
          )}
          {walletConnected && walletAddress && (
            <span className="font-mono text-[9px] text-secondary/80">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border/50 text-[10px]"
            disabled={pending !== null}
            onClick={handleAddPasskey}
            title="Guardar una passkey en este dispositivo"
          >
            <Fingerprint className="mr-1 h-3 w-3" /> Passkey
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border/50 text-[10px]"
            onClick={async () => {
              await signOut();
              toast.success("Sesión cerrada");
            }}
          >
            <LogOut className="mr-1 h-3 w-3" /> Salir
          </Button>
        </div>
      ) : (
        <>
          <div className={`grid ${gridClass} gap-1.5`}>
            {visibleProviders.map((provider) => {
              const Icon = PROVIDER_ICON[provider];
              const state = providerStates[provider];
              const dead = state === "missing-secret" || state === "disabled";
              const badge = providerStateLabel(state);
              return (
                <Button
                  key={provider}
                  type="button"
                  variant="outline"
                  onClick={() => handleProvider(provider)}
                  disabled={pending !== null || dead}
                  aria-disabled={dead || undefined}
                  aria-label={`${PROVIDER_LABEL[provider]}${badge ? ` — ${badge}` : ""}`}
                  title={
                    state === "missing-secret"
                      ? `${PROVIDER_LABEL[provider]}: el interruptor está encendido en Supabase pero faltan Client ID + Secret. No se puede iniciar sesión hasta configurarlo (${ENABLE_AT[provider] ?? "Authentication → Providers"}).`
                      : state === "disabled"
                        ? `${PROVIDER_LABEL[provider]} no está activado en este proyecto (${ENABLE_AT[provider] ?? "Authentication → Providers"}).`
                        : undefined
                  }
                  className={`relative h-8 justify-start gap-1.5 border-border/40 bg-card/40 px-1.5 text-[10px] transition-all ${
                    dead
                      ? "cursor-not-allowed border-dashed text-muted-foreground/50"
                      : "hover:border-primary/40 hover:bg-primary/10"
                  }`}
                >
                  {pending === provider ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="h-3 w-3 shrink-0" />
                  )}
                  {/* The name keeps its room: the state lives in the tooltip,
                      the dashboard guide and this lock glyph, not in a second
                      label that would squeeze the provider out of the button. */}
                  <span className="min-w-0 truncate">{PROVIDER_LABEL[provider]}</span>
                  {dead && (
                    <LockKeyhole
                      className={`absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 ${
                        state === "missing-secret" ? "text-amber-400/80" : "text-muted-foreground/50"
                      }`}
                      aria-hidden
                    />
                  )}
                </Button>
              );
            })}
          </div>

          {disabledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDisabledProviders((shown) => !shown)}
              className="w-full rounded border border-dashed border-border/40 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 transition-colors hover:border-primary/30 hover:text-foreground/80"
              aria-expanded={showDisabledProviders}
            >
              {showDisabledProviders
                ? `Ocultar los ${disabledCount} no activados`
                : `Ver los ${disabledCount} no activados`}
            </button>
          )}

          {deadCount > 0 && (
            <div className="flex items-start gap-2 pr-1 text-[10px] leading-4 text-muted-foreground/70" role="status">
              <p className="min-w-0 flex-1">
                {missingSecretCount > 0
                  ? `${SOCIAL_PROVIDERS.filter((p) => providerStates[p] === "missing-secret")
                      .map((p) => PROVIDER_LABEL[p])
                      .join(" y ")}: interruptor encendido sin Client ID + Secret, el servidor rechaza el inicio. `
                  : configuredCount === 0
                    ? "Ningún proveedor social está listo todavía. "
                    : `${configuredCount} de ${SOCIAL_PROVIDERS.length} listos. `}
                {disabledCount > 0 && `Otros ${disabledCount} sin activar. `}
                {"Se arreglan en Authentication → Providers (docs/oauth-google.md)."}
              </p>
              <button
                type="button"
                onClick={refreshProviders}
                className="mt-px flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-primary/70 transition-colors hover:text-primary disabled:opacity-50"
                disabled={!providersChecked}
                title="Volver a preguntar a Supabase, sin recargar la página"
              >
                <RotateCw className={`h-2.5 w-2.5 ${providersChecked ? "" : "animate-spin"}`} aria-hidden />
                {providersChecked ? "revisar" : "revisando"}
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full border-border/40 bg-card/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10"
            disabled={pending !== null}
            onClick={handlePasskey}
          >
            {pending === "passkey" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="mr-2 h-4 w-4" />
            )}
            <span className="text-xs">Entrar con Passkey (huella o Face ID)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full border-secondary/40 bg-secondary/5 text-secondary transition-all hover:border-secondary/60 hover:bg-secondary/15"
            disabled={walletBusy || pending !== null}
            onClick={handleWallet}
          >
            {walletBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            <span className="text-xs">
              {walletConnected && walletAddress
                ? `Firmar con ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                : "Conectar Wallet (Reown)"}
            </span>
          </Button>
          {walletError && <p className="text-center text-[10px] text-destructive">{walletError}</p>}

          {/* Acceso de respaldo: un camino que no depende de ningún proveedor
              externo. Va aquí, visible y sin plegar, porque el día que OAuth
              falla es justo cuando no se puede buscar entre pestañas. */}
          {showEmailForm && (
            <div className="rounded-lg border border-dashed border-primary/25 bg-primary/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-primary/80">
                <Mail className="h-3 w-3" aria-hidden /> Acceso de respaldo
              </p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground/70">
                Sin Google, Apple, passkey ni wallet: un enlace de un solo uso al email con el que entras.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-8 w-full border-primary/30 bg-card/40 text-[11px] text-foreground/85 transition-all hover:border-primary/50 hover:bg-primary/10"
                disabled={pending !== null}
                onClick={startMagic}
              >
                <Mail className="mr-2 h-3.5 w-3.5" /> Entrar con un enlace por email
              </Button>
            </div>
          )}
        </>
      )}

      {showEmailForm && !user && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full bg-border/30" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="bg-card px-3 font-mono text-muted-foreground/50">o directo</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-lg border border-border/40 bg-card/40 p-1">
            {DIRECT_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setDirectMode(option.id);
                  setSentTo(null);
                  setCode("");
                }}
                className={`h-7 rounded font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  directMode === option.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground/60 hover:text-foreground/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {directMode === "magic" && sentTo === "email" ? (
            <div
              role="status"
              className="space-y-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground/75"
            >
              <p className="flex items-start gap-1.5 text-primary/90">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Enlace enviado a <span className="font-mono text-foreground/90">{email}</span>. Caduca en 1 hora y
                  solo sirve una vez.
                </span>
              </p>
              <p>Si no llega en un minuto, revisa spam o promociones y reenvíalo.</p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-primary/40 text-[10px]"
                  disabled={pending !== null || cooling}
                  onClick={handleResendMagic}
                >
                  {pending === "email" ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCw className="mr-1 h-3 w-3" />
                  )}
                  {cooling ? `Reenviar en ${cooldown}s` : "Reenviar enlace"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] text-muted-foreground"
                  disabled={pending !== null}
                  onClick={changeEmail}
                >
                  Usar otro email
                </Button>
              </div>
            </div>
          ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            {directMode !== "phone" && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input
                    id="auth-email"
                    ref={emailRef}
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username webauthn"
                    className="h-10 border-border/30 bg-muted/30 pl-10"
                  />
                </div>
              </div>
            )}

            {directMode === "phone" && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-phone" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Teléfono
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input
                    id="auth-phone"
                    type="tel"
                    placeholder="+51 999 888 777"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    className="h-10 border-border/30 bg-muted/30 pl-10"
                  />
                </div>
              </div>
            )}
            {directMode === "password" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="h-10 border-border/30 bg-muted/30 pl-10"
                />
              </div>
            </div>
            )}

            {(directMode === "code" || directMode === "phone") && sentTo && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-code" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Código de 6 dígitos
                </Label>
                <Input
                  id="auth-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="h-10 border-border/30 bg-muted/30 text-center font-mono text-base tracking-[0.5em]"
                />
              </div>
            )}
            <Button
              type="submit"
              className="h-10 w-full bg-primary/90 font-heading text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary"
              disabled={pending !== null}
            >
              {pending === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {submitLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          )}

          {directMode === "password" && (
            <button
              type="button"
              onClick={() => setIsLogin((v) => !v)}
              className="w-full text-center font-mono text-[11px] tracking-wide text-muted-foreground/60 transition-colors hover:text-primary"
            >
              {isLogin ? "¿Sin identidad? → Crear cuenta" : "¿Ya tienes acceso? → Iniciar sesión"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
