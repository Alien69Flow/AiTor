import { Landmark, RefreshCw, Copy, ExternalLink, ShieldCheck, TriangleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDaoTreasury } from "@/hooks/useDaoTreasury";
import { DAOS } from "@/lib/ecosystem";

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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Landmark className="h-3.5 w-3.5 text-primary/70" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/55">
          Polygon · bloque {blockNumber ? blockNumber.toLocaleString("es-ES") : "—"}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-primary"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {updatedAt ? new Date(updatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "leer"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DAOS.map((dao) => {
          const row = rows.find((item) => item.id === dao.id);
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

              <div className="mt-3 flex items-baseline gap-1.5">
                {loading && !row?.balancePol ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                ) : row?.error ? (
                  <span className="text-[10px] text-amber-300/80">RPC no disponible · reintenta</span>
                ) : (
                  <>
                    <span className="font-mono text-lg leading-none text-primary">{row?.balancePol ?? "—"}</span>
                    <span className="font-mono text-[9px] uppercase text-muted-foreground/50">POL nativo</span>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <span className="truncate font-mono text-[9px] text-muted-foreground/40">{dao.address}</span>
                <button
                  type="button"
                  onClick={() => void copy(dao.address)}
                  aria-label="Copiar dirección"
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
                  Aragon <ExternalLink className="h-2.5 w-2.5" />
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

      <p className="px-1 font-mono text-[9px] leading-relaxed text-muted-foreground/40">
        Contrato verificado y saldo nativo leídos directamente del chain con RPC público, sin claves ni backend. La
        tesorería ERC-20 y las propuestas se consultan en Aragon.
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
