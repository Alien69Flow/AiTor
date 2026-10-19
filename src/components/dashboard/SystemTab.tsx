import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Gem,
  Globe2,
  Landmark,
  Layers,
  Plug,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  LogOut,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import { AuthMethods } from "@/components/auth/AuthMethods";
import { TelegramBridge } from "@/components/TelegramBridge";
import { DaoTreasury } from "./DaoTreasury";
import { CommandConsole } from "./CommandConsole";
import { PricingModal } from "./PricingModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useDaoAccess } from "@/hooks/useDaoAccess";
import { PLANS } from "@/lib/tiers";
import { DOMAINS, NFT_PROFILES, PRODUCTS, REPO, DAOS, type EcosystemProduct } from "@/lib/ecosystem";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";
import alienflowLogo from "@/assets/alienflow-logo.webp";
import aceLogo from "@/assets/ace.png";
import adexLogo from "@/assets/adex.png";
import aitorLogo from "@/assets/aitor-icon.png";

const LOGOS: Record<NonNullable<EcosystemProduct["logo"]>, string> = {
  ace: aceLogo,
  adex: adexLogo,
  aitor: aitorLogo,
};

const TIER_LABEL: Record<Tier, string> = {
  signal: "Signal · gratis",
  node: "Node · gratis con login",
  synapse: "Synapse · suscripción",
  oracle: "Oracle · NFT DAO",
  quantum: "Quantum · NFT + stake",
};

const INTEGRATIONS: { name: string; detail: string; live: boolean }[] = [
  { name: "Globo táctico", detail: "USGS · EMSC · NASA EONET · NOAA · Celestrak", live: true },
  { name: "Mercados & predicciones", detail: "Polymarket · DexScreener · DefiLlama · ECB", live: true },
  { name: "Tesorería DAO", detail: "Polygon RPC público · lectura directa sin claves", live: true },
  { name: "Cobros on-chain", detail: "USDC/USDT en Base y Polygon · verificación server-side", live: true },
  { name: "Núcleo de agentes (chat)", detail: "Requiere clave del proveedor LLM en Supabase Secrets", live: false },
  { name: "Capa meteorológica", detail: "Requiere OPENWEATHER_API_KEY", live: false },
  { name: "GitHub proxy", detail: "Requiere GITHUB_PAT para leer repos privados", live: false },
  { name: "Firecrawl deep search", detail: "Requiere FIRECRAWL_API_KEY", live: false },
];

function Section({
  id,
  title,
  subtitle,
  icon,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <div className="flex items-baseline gap-2 px-1">
        {icon}
        <h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">{title}</h3>
        {subtitle && <span className="font-mono text-[9px] text-muted-foreground/40">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border/35 bg-card/45 ${className}`}>{children}</div>;
}

export function SystemTab() {
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<string | undefined>(undefined);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { user } = useAuth();
  const { tier, authed } = useTier();
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signIn: walletSignIn, busy: walletBusy, error: walletError } = useWalletAuth();
  const { verify, busy: verifying, result: holdings, error: holdingsError } = useDaoAccess();

  const paidPlans = PLANS.filter((plan) => plan.access === "subscription" || plan.access.startsWith("nft"));
  const freePlans = PLANS.filter((plan) => plan.access === "free" || plan.access === "login");

  const openPricing = (plan?: Tier) => {
    setPricingReason(plan ? `Has elegido el nivel ${TIER_LABEL[plan]}.` : undefined);
    setPricingOpen(true);
  };

  const handlePlanAction = (plan: Tier) => {
    if (plan === "node" && !user) {
      document.getElementById("control-access")?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.message("Entra con una red social o con tu wallet para activar el nivel Node.");
      return;
    }
    openPricing(plan);
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Dirección copiada");
    } catch {
      toast.error("No se pudo copiar la dirección");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2.5 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-heading text-[11px] uppercase tracking-widest text-foreground/90">
              Centro de control
            </p>
            <p className="truncate font-mono text-[9px] text-muted-foreground/45">
              ΔlieπFlΦw · soberanía operativa
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="outline" className="hidden border-primary/30 bg-primary/5 font-mono text-[8px] text-primary sm:flex">
            {TIER_LABEL[tier]}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPricing()}
            className="h-7 border-accent/40 bg-accent/10 text-[10px] uppercase tracking-wider text-accent hover:bg-accent/20"
          >
            <Sparkles className="h-3 w-3 md:mr-1" />
            <span className="hidden md:inline">Niveles</span>
          </Button>
        </div>
      </div>

      <div className="scroll-pane min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12">
        <div className="mx-auto w-full max-w-5xl space-y-8">
          {/* Sovereignty summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "productos", value: PRODUCTS.length, href: "#control-ecosystem" },
              { label: "DAOs Aragon", value: DAOS.length, href: "#control-treasury" },
              { label: "dominios", value: DOMAINS.length, href: "#control-assets" },
            ].map((stat) => (
              <a
                key={stat.label}
                href={stat.href}
                className="rounded-xl border border-border/30 bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/35"
              >
                <p className="font-mono text-lg leading-none text-primary">{stat.value}</p>
                <p className="mt-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
                  {stat.label}
                </p>
              </a>
            ))}
          </div>

          {/* Ecosystem */}
          <Section id="control-ecosystem" title="Ecosistema" subtitle="todo operado desde aquí" icon={<Globe2 className="h-3.5 w-3.5 text-primary/70" />}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCTS.map((product) => (
                <a
                  key={product.id}
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/45 p-3 transition-all hover:border-primary/35 hover:bg-card/70"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                    style={{ borderColor: `${product.accent}55`, background: `${product.accent}14` }}
                  >
                    {product.logo ? (
                      <img src={LOGOS[product.logo]} alt={product.name} className="h-7 w-7 object-contain" />
                    ) : (
                      <product.Icon className="h-5 w-5" style={{ color: product.accent }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-heading text-[11px] uppercase tracking-wider text-foreground">
                        {product.name}
                      </span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary/60" />
                    </div>
                    <p className="truncate text-[9px] text-muted-foreground/55">{product.tagline}</p>
                    <p className="truncate font-mono text-[8px] text-muted-foreground/35">{product.host}</p>
                  </div>
                </a>
              ))}
            </div>
          </Section>

          {/* Treasury */}
          <Section id="control-treasury" title="Tesorería on-chain" subtitle="Aragon · Polygon" icon={<Landmark className="h-3.5 w-3.5 text-primary/70" />}>
            <DaoTreasury />
          </Section>

          {/* Command console */}
          <Section id="control-commands" title="Ejecución" subtitle="órdenes → agentes de código" icon={<Terminal className="h-3.5 w-3.5 text-primary/70" />}>
            <CommandConsole />
          </Section>

          {/* Identity + wallet + plans */}
          <Section id="control-access" title="Acceso e identidad" subtitle="social · wallet · email" icon={<ShieldCheck className="h-3.5 w-3.5 text-primary/70" />}>
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <img src={alienflowLogo} alt="ΔlieπFlΦw DAO" className="h-11 w-11 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm tracking-wide text-foreground">
                    <span className="text-secondary">Δlieπ</span>
                    <span className="text-primary">FlΦw</span>{" "}
                    <span className="text-muted-foreground/50">· Nexus</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user
                      ? `Sesión activa · ${TIER_LABEL[tier]}`
                      : authed === false
                        ? "Sin sesión: entras como Signal (acceso abierto)"
                        : "Comprobando sesión…"}
                  </p>
                </div>
                {user && (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-[9px] text-primary">
                    <BadgeCheck className="mr-1 h-3 w-3" /> verificado
                  </Badge>
                )}
              </div>

              <AuthMethods showEmailForm={showEmailForm} onSignedIn={() => setShowEmailForm(false)} />

              <div className="flex flex-wrap items-center gap-2 border-t border-border/25 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open()}
                  className="h-7 border-primary/40 bg-primary/10 text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
                >
                  <Wallet className="mr-1.5 h-3.5 w-3.5" />
                  {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Gestionar wallet"}
                </Button>
                {isConnected && (
                  <>
                    <span className="font-mono text-[9px] text-muted-foreground/50">chain {chainId ?? "—"}</span>
                    <Button variant="ghost" size="sm" onClick={copyAddress} aria-label="Copiar wallet" className="h-7 px-2">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnect()}
                      className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="mr-1 h-3.5 w-3.5" /> Desconectar
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={walletBusy}
                  onClick={async () => {
                    const ok = await walletSignIn();
                    if (ok) toast.success("Sesión iniciada con wallet");
                  }}
                  className="h-7 border-secondary/40 bg-secondary/5 text-[10px] uppercase tracking-wider text-secondary hover:bg-secondary/15"
                >
                  {walletBusy ? <CircleAlert className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                  Firmar y entrar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={verifying}
                  onClick={() => void verify()}
                  className="h-7 border-border/50 text-[10px] uppercase tracking-wider"
                >
                  {verifying ? "Verificando…" : "Verificar holdings DAO"}
                </Button>
                <Link to="/auth" className="font-mono text-[9px] text-primary/60 transition-colors hover:text-primary">
                  Página de acceso →
                </Link>
              </div>

              <TelegramBridge />

              {walletError && <p className="text-[10px] text-destructive">{walletError}</p>}
              {holdingsError && <p className="text-[10px] text-destructive">{holdingsError}</p>}
              {holdings && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <p className="font-mono text-[10px] text-primary">{holdings.message}</p>
                  {holdings.tier && (
                    <p className="mt-1 text-[10px] text-foreground/70">
                      Nivel desbloqueado: <span className="font-mono text-secondary">{TIER_LABEL[holdings.tier]}</span>
                    </p>
                  )}
                </div>
              )}

              {!user && (
                <button
                  type="button"
                  onClick={() => setShowEmailForm((value) => !value)}
                  className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/55 transition-colors hover:text-primary"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showEmailForm ? "rotate-180" : ""}`} />
                  {showEmailForm ? "Ocultar email y contraseña" : "Prefiero email y contraseña"}
                </button>
              )}
            </Card>

            <div className="mt-3 flex items-baseline gap-2 px-1">
              <h4 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/55">
                Niveles
              </h4>
              <span className="font-mono text-[9px] text-muted-foreground/40">
                {freePlans.length} gratis · {paidPlans.length} de pago
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {PLANS.map((plan) => {
                const active = plan.id === tier;
                const included = TIER_RANK[tier] > TIER_RANK[plan.id];
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-xl border bg-card/40 p-3 ${
                      active ? "border-primary/60" : plan.highlight ? "border-accent/50" : "border-border/35"
                    }`}
                  >
                    {active && (
                      <span className="absolute -top-2 right-2 bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary-foreground">
                        Activo
                      </span>
                    )}
                    {plan.highlight && !active && (
                      <span className="absolute -top-2 left-2 bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent-foreground">
                        Popular
                      </span>
                    )}
                    <plan.Icon className="mb-1 h-4 w-4" style={{ color: plan.accent }} />
                    <p className="font-heading text-[10px] uppercase tracking-wider text-foreground/85">{plan.name}</p>
                    <p className="font-mono text-[10px] leading-tight" style={{ color: plan.accent }}>
                      {plan.price}
                    </p>
                    {plan.priceNote && <p className="text-[8px] text-muted-foreground/55">{plan.priceNote}</p>}
                    <ul className="mt-1.5 flex-1 space-y-0.5">
                      {plan.features.slice(0, 2).map((feature) => (
                        <li key={feature} className="flex gap-1 text-[9px] text-foreground/65">
                          <span style={{ color: plan.accent }}>▸</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={active}
                      onClick={() => handlePlanAction(plan.id)}
                      className="mt-2 h-6 w-full text-[9px] uppercase tracking-wider"
                    >
                      {active ? "Plan actual" : included ? "Incluido" : "Ver y activar"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="px-1 font-mono text-[9px] text-muted-foreground/45">
              Signal y Node son gratis (Node requiere cuenta). Synapse se cobra en USDC/USDT en Base o Polygon; Oracle
              y Quantum se activan verificando el NFT de la DAO y los tokens en cartera.
            </p>
          </Section>

          {/* NFT + domains */}
          <Section id="control-assets" title="NFT y dominios" subtitle="OpenSea · Unstoppable" icon={<Gem className="h-3.5 w-3.5 text-primary/70" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {NFT_PROFILES.map((profile) => (
                <a
                  key={profile.id}
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/45 p-3 transition-colors hover:border-primary/35"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <profile.Icon className="h-4 w-4 text-primary/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-[11px] uppercase tracking-wider text-foreground">
                      {profile.name}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground/55">{profile.detail}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary/60" />
                </a>
              ))}
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DOMAINS.map((domain) => (
                <a
                  key={domain.domain}
                  href={domain.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border/30 bg-card/40 p-3 transition-colors hover:border-secondary/40"
                >
                  <p className="truncate font-mono text-[10px] text-secondary">{domain.domain}</p>
                  <p className="truncate text-[9px] text-muted-foreground/50">{domain.note}</p>
                </a>
              ))}
            </div>
          </Section>

          {/* Integrations */}
          <Section id="control-integrations" title="Integraciones" subtitle="estado real de este despliegue" icon={<Plug className="h-3.5 w-3.5 text-primary/70" />}>
            <Card className="space-y-2 p-3.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {INTEGRATIONS.map((item) => (
                  <div key={item.name} className="flex items-start gap-2 rounded-lg border border-border/25 bg-muted/10 px-2.5 py-2">
                    <Plug className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.live ? "text-primary" : "text-amber-300/80"}`} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[10px] text-foreground/85">
                        {item.name}
                        <span className={`font-mono text-[8px] uppercase ${item.live ? "text-primary/80" : "text-amber-300/80"}`}>
                          {item.live ? "live" : "requiere clave"}
                        </span>
                      </p>
                      <p className="truncate text-[9px] text-muted-foreground/55" title={item.detail}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          <div className="border-t border-border/25 px-1 pb-4 pt-4 text-center">
            <a
              href={REPO.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 transition-colors hover:text-primary"
            >
              {REPO.owner}/{REPO.name} · código abierto
            </a>
          </div>
        </div>
      </div>

      <PricingModal
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        reason={pricingReason}
        currentTier={tier}
      />
    </div>
  );
}
