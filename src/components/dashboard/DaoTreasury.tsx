import { RefreshCw, Copy, ExternalLink, ShieldCheck, TriangleAlert, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDaoTreasury } from "@/hooks/useDaoTreasury";
import { DAOS } from "@/lib/ecosystem";

/** "1,234.5678" → 1234.5678, or null when the row has no reading. */
function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Live, keyless read of the two Aragon DAOs on Polygon. */
export function DaoTreasury() {
  const { rows, blockNumber, loading, updatedAt, refresh } = useDaoTreasury();

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Dirección copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  // A zero native balance is the normal state of an Aragon DAO registry, not a
  // failure: it is summed here and shown once, instead of two giant zeros.
  const balances = rows.map((row) => toNumber(row.balancePol));
  // Summed only when every contract answered: a half-read treasury is not a zero.
  const total = balances.some((value) => value === null)
    ? null
    : balances.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const verified = rows.filter((row) => row.isContract === true).length;
  const readAt = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/55">
          bloque {blockNumber ? blockNumber.toLocaleString("es-ES") : "—"}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-primary"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {readAt}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "contratos", value: `${verified}/${DAOS.length}`, hint: "verificados on-chain" },
          {
            label: "POL nativo",
            value: total === null ? "—" : toNumber(total.toFixed(4)) === 0 ? "0" : total.toLocaleString("es-ES", { maximumFractionDigits: 4 }),
            hint: "suma de los dos contratos",
          },
          { label: "lectura", value: readAt, hint: "RPC público, sin claves" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/30 bg-card/40 px-3 py-2"
            title={stat.hint}
          >
            <p className="font-mono text-base leading-none text-primary/90">{stat.value}</p>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DAOS.map((dao) => {
          const row = rows.find((item) => item.id === dao.id);
          const balance = toNumber(row?.balancePol);
          const empty = balance === 0;
          return (
            <div key={dao.id} className="rounded-xl border border-border/35 bg-card/45 p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-[11px] uppercase tracking-wider text-foreground/90">
                    {dao.name}
                  </p>
                  <p className="truncate text-[9px] text-muted-foreground/55">{dao.role}</p>
                </div>
                {row?.isContract === true && (
                  <span className="inline-flex shrink-0 items-center gap-1 border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-primary">
                    <ShieldCheck className="h-2.5 w-2.5" /> on-chain
                  </span>
                )}
              </div>

              <div className="mt-3 flex min-h-7 items-center gap-2">
                {loading && row?.balancePol === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                ) : row?.error ? (
                  <span className="text-[10px] text-amber-300/80">RPC no disponible · reintenta</span>
                ) : empty ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground/70">
                      <Wallet className="h-2.5 w-2.5" /> sin POL nativo
                    </span>
                    <span className="truncate text-[9px] text-muted-foreground/55">
                      listo para recibir
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-lg leading-none text-primary">
                      {row?.balancePol ?? "—"}
                    </span>
                    <span className="font-mono text-[9px] uppercase text-muted-foreground/50">POL nativo</span>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <span className="truncate font-mono text-[9px] text-muted-foreground/40">{dao.address}</span>
                <button
                  type="button"
                  onClick={() => void copy(dao.address)}
                  aria-label={`Copiar la dirección de ${dao.name}`}
                  title="Copiar para depositar"
                  className="text-muted-foreground/40 transition-colors hover:text-primary"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={dao.aragonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
                >
                  Tesorería en Aragon <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <a
                  href={`https://polygonscan.com/address/${dao.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  PolygonScan <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              {row?.error && (
                <p className="mt-2 flex items-center gap-1 text-[9px] text-amber-300/70">
                  <TriangleAlert className="h-3 w-3" /> {row.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-1 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
        Contrato y saldo nativo leídos directamente del chain con RPC público, sin claves ni backend. Un
        cero aquí es normal: la dirección de la DAO es su registro on-chain, y los fondos —POL, tokens o
        NFTs— viven en el vault de Aragon, que se abre con el enlace «Tesorería en Aragon».
      </p>

      {rows.every((row) => row.error) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          className="h-7 border-border/50 text-[9px] uppercase tracking-wider"
        >
          Reintentar lectura on-chain
        </Button>
      )}
    </div>
  );
}
