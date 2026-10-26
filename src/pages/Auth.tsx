import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { SpaceBackground } from "@/components/SpaceBackground";
import { AuthMethods } from "@/components/auth/AuthMethods";
import alienflowLogo from "@/assets/alienflow-logo.webp";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";
  const nextUrl = window.location.origin + nextPath;

  useEffect(() => {
    if (!loading && user) {
      if (nextPath.startsWith("/.lovable/")) {
        window.location.replace(nextUrl);
      } else {
        navigate(nextPath, { replace: true });
      }
    }
  }, [user, loading, navigate, nextPath, nextUrl]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(105,175,0,0.4)]" />
          <p className="animate-pulse font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
            Sincronizando identidad...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Acceso | Ai Tor</title>
        <meta name="description" content="Accede a Ai Tor — Terminal de Inteligencia Autónoma de ΔlieπFlΦw DAO" />
        <link rel="canonical" href="https://aitor.alienflow.space/auth" />
        <meta property="og:title" content="Acceso | Ai Tor" />
        <meta property="og:description" content="Accede a Ai Tor — Terminal de Inteligencia Autónoma de ΔlieπFlΦw DAO" />
        <meta property="og:url" content="https://aitor.alienflow.space/auth" />
        <meta name="twitter:title" content="Acceso | Ai Tor" />
        <meta name="twitter:description" content="Accede a Ai Tor — Terminal de Inteligencia Autónoma de ΔlieπFlΦw DAO" />
      </Helmet>
      <SpaceBackground />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-lg">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 opacity-60 blur-xl" />

          {/* 19 provider buttons plus the wallet, the passkey and the form are
              taller than a laptop screen: the panel keeps a height it can show
              and scrolls inside instead of running past the fold. */}
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-primary/20 bg-card/80 shadow-[0_0_40px_rgba(105,175,0,0.1)] backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(105,175,0,0.1) 2px, rgba(105,175,0,0.1) 4px)',
              }}
            />

            <div className="relative px-6 pb-3 pt-5 text-center sm:px-8">
              <div className="mb-2 flex justify-center">
                <img
                  src={alienflowLogo}
                  alt="ΔlieπFlΦw DAO"
                  className="h-14 w-14 object-contain drop-shadow-[0_0_12px_rgba(105,175,0,0.4)]"
                />
              </div>
              <h1 className="font-heading text-2xl tracking-wider">
                <span className="text-secondary drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">Δlieπ</span>
                <span className="text-primary drop-shadow-[0_0_8px_rgba(105,175,0,0.3)]">FlΦw</span>
              </h1>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
                ≡ Acceso al Nexo Soberano ≡
              </p>
            </div>

            <div className="px-6 pb-7 sm:px-8">
              <AuthMethods redirectTo={nextUrl} columns={4} showEmailForm />
              <p className="mt-3 text-center font-mono text-[7px] leading-relaxed text-muted-foreground/30">
                Al acceder aceptas los términos del protocolo ΔlieπFlΦw. Tu soberanía digital es sagrada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
