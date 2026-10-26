import { useState, useEffect, useCallback } from "react";
import { User, Session, type Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Every OAuth provider the login surfaces can offer, all of them through
 * Supabase Auth — there is no Lovable broker in the flow anymore. A provider
 * only works once it is enabled in Authentication → Providers (or, for
 * `custom:*`, in Custom Providers); until then the sign-in call returns an
 * explicit "provider is not enabled" error instead of failing silently.
 *
 * Instagram is deliberately absent: Meta does not offer a "sign in with
 * Instagram" flow at all, so the login page does not offer it either.
 *
 * WeChat is offered, but as a custom provider (`custom:wechat`): Supabase has
 * no built-in WeChat connector, because WeChat's login is a QR/code exchange
 * without OIDC discovery. It is registered under Authentication → Providers →
 * Custom Providers (the free plan allows three custom providers).
 */
export const SOCIAL_PROVIDERS = [
  "google",
  "apple",
  "microsoft",
  "github",
  "x",
  "discord",
  "facebook",
  "linkedin",
  "reddit",
  "twitch",
  "gitlab",
  "bitbucket",
  "slack",
  "spotify",
  "notion",
  "figma",
  "zoom",
  "kakao",
  "wechat",
] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * Supabase provider id for each button. The UI name and the GoTrue id do not
 * always match: X moved to OAuth 2.0 under the id `x` (the old `twitter` is the
 * deprecated OAuth 1.0a flow), Slack uses the OIDC variant, LinkedIn uses
 * `linkedin_oidc`, Microsoft is `azure`, and two are not built-in at all:
 * Reddit and WeChat are manual custom providers registered in Supabase as
 * `custom:reddit` and `custom:wechat`.
 */
export const GOTRUE_PROVIDER: Record<SocialProvider, string> = {
  google: "google",
  apple: "apple",
  microsoft: "azure",
  github: "github",
  x: "x",
  discord: "discord",
  facebook: "facebook",
  linkedin: "linkedin_oidc",
  reddit: "custom:reddit",
  twitch: "twitch",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  slack: "slack_oidc",
  spotify: "spotify",
  notion: "notion",
  figma: "figma",
  zoom: "zoom",
  kakao: "kakao",
  wechat: "custom:wechat",
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, redirectTo?: string, captchaToken?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo || window.location.origin,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      return { error };
    },
    [],
  );

  /**
   * Every social provider goes through Supabase's own OAuth flow.
   *
   * The old Lovable broker (`/~oauth/initiate` → `oauth.lovable.app`) only
   * exists on Lovable-hosted domains and only accepts `aitor.lovable.app` as a
   * `redirect_uri`, so on `aitor.alienflow.space` it ended in a 404 or bounced
   * the user to a foreign domain. Supabase does the whole exchange natively
   * once the provider is enabled in Authentication → Providers.
   */
  const nativeOAuth = useCallback(
    async (provider: string, redirectTo?: string) => {
      const target = redirectTo || window.location.origin;
      const { data, error } = await supabase.auth.signInWithOAuth({
        // auth-js 2.87 still types the older provider ids, but GoTrue also
        // accepts `x` and `custom:*`, which this client just forwards.
        provider: provider as Provider,
        options: { redirectTo: target, skipBrowserRedirect: true },
      });
      if (error) return { error };

      // Supabase only validates the provider when /authorize is reached, and
      // without this pre-flight a provider with missing credentials navigates
      // the user to a raw JSON error page. Probe it first, keep the message and
      // only then hand the browser over to the identity provider.
      try {
        const res = await fetch(data.url);
        const payload = (await res.json().catch(() => null)) as
          | { url?: string; msg?: string }
          | null;
        if (!res.ok || !payload?.url) {
          return {
            error: new Error(payload?.msg || "Supabase no pudo iniciar el OAuth"),
          };
        }
        window.location.assign(payload.url);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (redirectTo?: string) => nativeOAuth("google", redirectTo),
    [nativeOAuth],
  );

  const signInWithApple = useCallback(
    async (redirectTo?: string) => nativeOAuth("apple", redirectTo),
    [nativeOAuth],
  );

  /** One entry point for every OAuth provider. */
  const signInWithProvider = useCallback(
    async (provider: SocialProvider, redirectTo?: string) => {
      // Same path for all: pre-flight /authorize so a provider that is not
      // enabled yet shows its message in the app instead of a raw JSON page.
      return nativeOAuth(GOTRUE_PROVIDER[provider], redirectTo);
    },
    [nativeOAuth],
  );

  /**
   * Passwordless email. Supabase sends a magic link by default and the same
   * call backs the six-digit code — only the email template differs — so both
   * modes share one function. Email auth is already on for the password form.
   */
  const sendEmailOtp = useCallback(
    async (email: string, redirectTo?: string, captchaToken?: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo || window.location.origin,
          shouldCreateUser: true,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      return { error };
    },
    [],
  );

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    return { error };
  }, []);

  /**
   * SMS codes. Supabase only relays them: an SMS provider (Twilio, MessageBird
   * or Vonage) has to be configured in Authentication → Phone, otherwise the
   * call answers with an explicit error that the UI shows as it comes.
   */
  const sendPhoneCode = useCallback(async (phone: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error };
  }, []);

  const verifyPhoneCode = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    return { error };
  }, []);

  /**
   * Passkeys (WebAuthn). The whole ceremony lives in supabase-js since v2.105:
   * the browser prompts for a fingerprint, face or hardware key and Supabase
   * verifies the challenge. A signed-in user registers one with
   * `registerPasskey`, a visitor consumes one with `signInWithPasskey`; both
   * still need the feature switched on in Authentication → Sign In → Passkeys.
   *
   * `mediation: "conditional"` turns the same call into WebAuthn Conditional
   * UI: the browser offers the passkey through the email field's autofill
   * instead of opening a modal picker.
   */
  const signInWithPasskey = useCallback(
    async (credentials?: {
      options?: { mediation?: CredentialMediationRequirement; captchaToken?: string };
    }) => {
      const { error } = await supabase.auth.signInWithPasskey(credentials);
      return { error };
    },
    [],
  );

  const registerPasskey = useCallback(async () => {
    const { error } = await supabase.auth.registerPasskey();
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signInWithProvider,
    sendEmailOtp,
    verifyEmailCode,
    sendPhoneCode,
    verifyPhoneCode,
    signInWithPasskey,
    registerPasskey,
    signOut,
  };
}
