import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Loader2, Mail, Lock, Wallet, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth, SOCIAL_PROVIDERS, type SocialProvider } from "@/hooks/useAuth";
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
};

/** Where to enable each provider in the Supabase dashboard, for the toast. */
const ENABLE_AT: Partial<Record<SocialProvider, string>> = {
  reddit: "Authentication → Providers → Custom Providers → custom:reddit",
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
 * Zoom, Kakao), a Reown wallet signature (SIWE) and email + password. Meta
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
  const { user, signIn, signUp, signInWithProvider, signOut } = useAuth();
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
  const [pending, setPending] = useState<SocialProvider | "email" | null>(null);

  const target = redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined);
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

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setPending("email");
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message.includes("Invalid login credentials") ? "Credenciales incorrectas" : error.message);
        } else {
          toast.success("¡Bienvenido, Soberano!");
          onSignedIn?.();
        }
      } else {
        const { error } = await signUp(email, password, target);
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
          {walletConnected && walletAddress && (
            <span className="font-mono text-[9px] text-secondary/80">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          )}
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
          <div className={`grid ${gridClass} gap-2`}>
            {SOCIAL_PROVIDERS.map((provider) => {
              const Icon = PROVIDER_ICON[provider];
              return (
                <Button
                  key={provider}
                  type="button"
                  variant="outline"
                  onClick={() => handleProvider(provider)}
                  disabled={pending !== null}
                  className="h-9 border-border/40 bg-card/40 px-2 text-[10px] transition-all hover:border-primary/40 hover:bg-primary/10"
                >
                  {pending === provider ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{PROVIDER_LABEL[provider]}</span>
                </Button>
              );
            })}
          </div>

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
        </>
      )}

      {showEmailForm && !user && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full bg-border/30" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="bg-card px-3 font-mono text-muted-foreground/50">o con email</span>
            </div>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 border-border/30 bg-muted/30 pl-10"
                />
              </div>
            </div>
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
            <Button
              type="submit"
              className="h-10 w-full bg-primary/90 font-heading text-sm uppercase tracking-wider text-primary-foreground hover:bg-primary"
              disabled={pending !== null}
            >
              {pending === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Acceder al Nexo" : "Crear Identidad"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsLogin((v) => !v)}
            className="w-full text-center font-mono text-[11px] tracking-wide text-muted-foreground/60 transition-colors hover:text-primary"
          >
            {isLogin ? "¿Sin identidad? → Crear cuenta" : "¿Ya tienes acceso? → Iniciar sesión"}
          </button>
        </>
      )}
    </div>
  );
}
