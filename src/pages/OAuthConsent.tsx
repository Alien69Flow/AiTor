import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SpaceBackground } from "@/components/SpaceBackground";
import { Loader2, Shield, AlertTriangle } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function safeSameOriginPath(next: string | null): string {
  if (!next) return "/";
  try {
    if (!next.startsWith("/") || next.startsWith("//")) return "/";
    return next;
  } catch {
    return "/";
  }
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauthApi?.getAuthorizationDetails) {
        setError("OAuth server not available. Please try again later.");
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message ?? "Could not load authorization");
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauthApi.approveAuthorization(authorizationId)
        : await oauthApi.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message ?? "Authorization failed");
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("No redirect returned by the authorization server.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error");
      setBusy(false);
    }
  }

  return (
    <>
      <SpaceBackground />
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-background/70 backdrop-blur-xl p-8 shadow-[0_0_40px_rgba(105,175,0,0.15)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-heading tracking-wider text-foreground">
                Agent Integration
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                AI Tor · MCP Access
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!details && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading authorization request…
            </div>
          )}

          {details && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-foreground">
                  Connect{" "}
                  <strong className="text-primary">
                    {details.client?.client_name ?? details.client?.name ?? "an external app"}
                  </strong>{" "}
                  to your AI Tor account.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This lets it call AI Tor's enabled tools while acting as you. This does not
                  bypass this app's permissions or backend policies.
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-card/40 p-3 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Requested access
                </div>
                <div className="text-xs text-foreground">Share your basic profile</div>
                <div className="text-xs text-foreground">Share your email address</div>
                <div className="text-xs text-foreground">Call enabled AI Tor tools as you</div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { safeSameOriginPath };