import { useState } from "react";
import { Settings, Wallet, Key, Shield, User, Radio, Sparkles, ExternalLink, Globe, Landmark } from "lucide-react";
import { OsintConsole } from "./OsintConsole";
import { PricingModal } from "./PricingModal";

type Tab = "dao" | "osint";

const DAO_LINKS = [
  {
    label: "AlienFlow DAO",
    url: "https://www.alienflow.space",
    desc: "Official website",
    logo: "/alienflow-logo.webp",
  },
  {
    label: "DAO Docs",
    url: "https://alienflowspace.gitbook.io/DAO",
    desc: "GitBook documentation",
    logo: "",
  },
   {
    label: "ACE DAPPs",
    url: "https://ace.alienflow.space",
    desc: "Autonomous Cognitive Engine | A CashFlow Energy",
    logo: "/ace.png",
  },
  {
    label: "ADEX",
    url: "https://adex.alienflow.space",
    desc: "Alien DEX & Play HUB",
    logo: "/adex.png",
  },
  {
    label: "ATrip",
    url: "https://atrip.alienflow.space",
    desc: "Alien Travel Trip ",
    logo: "",
  },
  {
    label: "Alien69Flow OpenSea",
    url: "https://opensea.io/Alien69Flow",
    desc: "Official creator profile · Ethereum wallet",
    logo: "",
  },
  {
    label: "AlienFlowSpace OpenSea",
    url: "https://opensea.io/AlienFlowSpace",
    desc: "Official DAO profile · Ethereum wallet",
    logo: "",
  },
  {
    label: "GitHub",
    url: "https://github.com/Alien69Flow/AiTor",
    desc: "Source repository",
    logo: "",
  },
];

export function SystemTab() {
  const [tab, setTab] = useState<Tab>("osint");
  const [pricingOpen, setPricingOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-3 border-b border-border/30">
        <button
          onClick={() => setTab("osint")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-heading tracking-widest uppercase border-b-2 transition-colors ${
            tab === "osint"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          OSINT
        </button>
        <button
          onClick={() => setTab("dao")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-heading tracking-widest uppercase border-b-2 transition-colors ${
            tab === "dao"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          DAO
        </button>
        <button
          onClick={() => setPricingOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-heading tracking-widest uppercase rounded-md border border-[#69af00]/40 text-[#69af00] hover:bg-[#69af00]/10 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Upgrade
        </button>
      </div>

      {tab === "osint" ? (
        <OsintConsole />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
          <div className="max-w-2xl w-full space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center border border-primary/20 bg-primary/10">
                <Landmark className="h-8 w-8 text-primary" aria-label="AlienFlow DAO" />
              </div>
              <div>
                <h2 className="text-xl font-heading text-foreground tracking-wide">DAO System</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Governance, profile, wallet & API key management
                </p>
              </div>
            </div>

            {/* Official Links Grid */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-heading uppercase tracking-widest text-muted-foreground/50 px-1">Official Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DAO_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/50 hover:border-primary/30 hover:bg-card/70 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0 overflow-hidden">
                      {link.logo ? (
                        <img
                          src={link.logo}
                          alt={link.label}
                          className="w-7 h-7 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Globe className="w-5 h-5 text-primary/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-heading text-foreground tracking-wider uppercase">{link.label}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{link.desc}</p>
                      <p className="text-[8px] text-muted-foreground/30 font-mono truncate mt-0.5">{link.url.replace('https://www.', '').replace('https://', '')}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Feature tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: User, label: "Profile", desc: "Coming soon" },
                { icon: Wallet, label: "Wallet", desc: "Connect Web3" },
                { icon: Key, label: "API Keys", desc: "CoinGecko, Firecrawl" },
                { icon: Shield, label: "Governance", desc: "DAO voting" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/30 bg-card/50 hover:border-primary/30 transition-colors"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-heading text-foreground tracking-wider uppercase">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </div>
  );
}
