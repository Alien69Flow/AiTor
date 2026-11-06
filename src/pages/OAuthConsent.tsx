import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SpaceBackground } from "@/components/SpaceBackground";
import { Loader2, ShieldCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta el parámetro authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("El servidor de autorización no devolvió una URL de retorno.");
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "la aplicación";
  const scopes: string[] = String(details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <>
      <Helmet>
        <title>Autorizar aplicación | Ai Tor</title>
        <meta name="description" content="Pantalla de consentimiento OAuth de Ai Tor: revisa los permisos solicitados antes de conectar una aplicación externa a tu cuenta." />
        <meta name="robots" content="noindex" />
        <meta property="og:title" content="Autorizar aplicación | Ai Tor" />
        <meta property="og:description" content="Revisa los permisos solicitados antes de conectar una aplicación externa a tu cuenta de Ai Tor." />
      </Helmet>
      <SpaceBackground />
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-card/80 p-8 backdrop-blur-xl">
          {error ? (
            <>
              <h1 className="mb-2 text-lg font-bold text-destructive">No se pudo cargar la autorización</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Verificando solicitud…</span>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Autorización</span>
              </div>
              <h1 className="mb-2 text-xl font-bold">Conectar {clientName} a Ai Tor</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                Esto permite que {clientName} use las herramientas de esta app como tú
                {email ? ` (${email})` : ""}.
              </p>
              {details?.client?.redirect_uri && (
                <p className="mb-3 break-all font-mono text-[11px] text-muted-foreground">
                  Redirección: {details.client.redirect_uri}
                </p>
              )}
              {scopes.length > 0 && (
                <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
                  {scopes.map((s) => (
                    <li key={s}>
                      •{" "}
                      {s === "email"
                        ? "Compartir tu email"
                        : s === "profile"
                          ? "Compartir tu perfil básico"
                          : s === "openid"
                            ? "Verificar tu identidad"
                            : `Permiso adicional: ${s}`}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-6 text-xs text-muted-foreground">
                Esto no elude los permisos ni las políticas de seguridad de la app.
              </p>
              <div className="flex gap-3">
                <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprobar"}
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
