/**
 * What it actually takes to turn each social sign-in on.
 *
 * The status of a provider is measured at runtime (`/auth/v1/settings` plus a
 * probe of `/auth/v1/authorize`), but "sin configurar" only says *what* is
 * missing, not where to fix it. This table answers that, provider by provider,
 * so the panel does not need a doc open in another tab.
 *
 * `effort` is about gates, not typing speed:
 *   · sinRevision — create the app in the provider's console, paste two values;
 *   · conRevision — the provider reviews the app before it works in production;
 *   · requiereCuenta — needs a paid developer account or regional verification.
 */
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { GOTRUE_PROVIDER, type SocialProvider } from "@/hooks/useAuth";

export type ProviderEffort = "sinRevision" | "conRevision" | "requiereCuenta";

export interface ProviderSetup {
  /** Where the OAuth app is created. */
  console: string;
  /** Path inside the Supabase dashboard. */
  path: string;
  /** What has to be copied across. */
  need: string;
  effort: ProviderEffort;
}

export const EFFORT_LABEL: Record<ProviderEffort, string> = {
  sinRevision: "sin revisión",
  conRevision: "con revisión",
  requiereCuenta: "requiere cuenta",
};

export const EFFORT_TONE: Record<ProviderEffort, string> = {
  sinRevision: "border-primary/35 bg-primary/10 text-primary",
  conRevision: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  requiereCuenta: "border-secondary/35 bg-secondary/10 text-secondary",
};

/** The one URL every provider has to whitelist: Supabase's callback. */
export const SUPABASE_CALLBACK = `${SUPABASE_URL}/auth/v1/callback`;

export const PROVIDER_SETUP: Record<SocialProvider, ProviderSetup> = {
  google: {
    console: "Google Cloud → Google Auth Platform → Clients",
    path: "Authentication → Providers → Google",
    need: "Client ID + Client secret",
    effort: "sinRevision",
  },
  apple: {
    console: "Apple Developer → Identifiers → Services IDs",
    path: "Authentication → Providers → Apple",
    need: "Services ID, Team ID, Key ID y el .p8 (el secret caduca a los 6 meses)",
    effort: "requiereCuenta",
  },
  microsoft: {
    console: "Azure Portal → App registrations",
    path: "Authentication → Providers → Azure",
    need: "Application (client) ID + secret",
    effort: "sinRevision",
  },
  github: {
    console: "GitHub → Settings → Developer settings → OAuth Apps",
    path: "Authentication → Providers → GitHub",
    need: "Client ID + Client secret",
    effort: "sinRevision",
  },
  x: {
    console: "X Developer Portal → Apps",
    path: "Authentication → Providers → X / Twitter",
    need: "OAuth 2.0 Client ID + Secret (la API necesita plan)",
    effort: "conRevision",
  },
  discord: {
    console: "Discord Developer Portal → Applications",
    path: "Authentication → Providers → Discord",
    need: "Client ID + Client secret",
    effort: "sinRevision",
  },
  facebook: {
    console: "Meta for Developers → App → Facebook Login",
    path: "Authentication → Providers → Facebook",
    need: "App ID + App secret (y revisión de Meta para producción)",
    effort: "conRevision",
  },
  linkedin: {
    console: "LinkedIn Developer Portal → Apps",
    path: "Authentication → Providers → LinkedIn (OIDC)",
    need: "Client ID + Secret, con página de empresa verificada",
    effort: "conRevision",
  },
  reddit: {
    console: "reddit.com/prefs/apps → create app (type: web)",
    path: "Authentication → Providers → Custom Providers → custom:reddit",
    need: "Client ID + Secret (Reddit no es proveedor nativo)",
    effort: "conRevision",
  },
  twitch: {
    console: "Twitch Developer Console → Applications",
    path: "Authentication → Providers → Twitch",
    need: "Client ID + Client secret",
    effort: "sinRevision",
  },
  gitlab: {
    console: "GitLab → Preferences → Applications",
    path: "Authentication → Providers → GitLab",
    need: "Application ID + Secret",
    effort: "sinRevision",
  },
  bitbucket: {
    console: "Atlassian Developer → OAuth consumers",
    path: "Authentication → Providers → Bitbucket",
    need: "Key + Secret",
    effort: "sinRevision",
  },
  slack: {
    console: "Slack API → Your Apps",
    path: "Authentication → Providers → Slack (OIDC)",
    need: "Client ID + Secret + scopes",
    effort: "conRevision",
  },
  spotify: {
    console: "Spotify Developer Dashboard",
    path: "Authentication → Providers → Spotify",
    need: "Client ID + Client secret",
    effort: "sinRevision",
  },
  notion: {
    console: "Notion → My integrations",
    path: "Authentication → Providers → Notion",
    need: "OAuth client ID + secret",
    effort: "conRevision",
  },
  figma: {
    console: "Figma → Settings → Developers",
    path: "Authentication → Providers → Figma",
    need: "Client ID + Secret",
    effort: "conRevision",
  },
  zoom: {
    console: "Zoom Marketplace → Build App",
    path: "Authentication → Providers → Zoom",
    need: "Client ID + Secret",
    effort: "conRevision",
  },
  kakao: {
    console: "Kakao Developers → 내 애플리케이션",
    path: "Authentication → Providers → Kakao",
    need: "REST API key + Client secret",
    effort: "conRevision",
  },
  wechat: {
    console: "WeChat Open Platform (open.weixin.qq.com)",
    path: "Authentication → Providers → Custom Providers → custom:wechat",
    need: "AppID + AppSecret (exige cuenta de empresa china verificada)",
    effort: "requiereCuenta",
  },
};

/** Provider id as GoTrue knows it, for the copy-to-clipboard helpers. */
export function gotrueId(provider: SocialProvider): string {
  return GOTRUE_PROVIDER[provider];
}
