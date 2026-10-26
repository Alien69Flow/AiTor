import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Bell, Pencil, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { fetchAllUapSightingsRows } from "@/lib/uap-sightings";
import {
  ALERTS_STORAGE_KEY,
  ALERT_COINS,
  EMPTY_DRAFT,
  alertFromDraft,
  describeAlert,
  draftFromAlert,
  parseStoredAlerts,
  priceConditionMet,
  uapMatches,
  upsertAlert,
  validateDraft,
  type Alert,
  type AlertDraft,
  type AlertKind,
  type UapAlert,
} from "@/lib/alerts";

const UAP_POLL_MS = 5 * 60_000;

function readStoredAlerts(): Alert[] {
  try {
    return parseStoredAlerts(localStorage.getItem(ALERTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** `$1.234,5` para precios; el umbral lo formatea `describeAlert`. */
function formatPrice(value: number): string {
  const digits = value < 1 ? 4 : value < 100 ? 2 : 0;
  return `$${value.toLocaleString("es-ES", { maximumFractionDigits: digits })}`;
}

export function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[]>(readStoredAlerts);
  const [draft, setDraft] = useState<AlertDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { prices } = useCryptoPrices(60_000);
  const priceById = useMemo(() => new Map(prices.map((coin) => [coin.id, coin.price])), [prices]);

  // The async checks read the latest list without restarting their timers.
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch {
      // Private mode: the alerts live for this session only.
    }
  }, [alerts]);

  /* ------------------------------------------------------- price checks */

  useEffect(() => {
    if (priceById.size === 0) return;

    setAlerts((previous) => {
      let changed = false;
      const next = previous.map((alert) => {
        if (alert.kind !== "price" || !alert.active) return alert;
        const price = priceById.get(alert.coinId);
        if (price === undefined || price === 0) return alert;
        const met = priceConditionMet(alert, price);
        if (met === alert.triggered) return alert;

        changed = true;
        if (met) {
          toast.success(`🔔 ${describeAlert(alert)}`, {
            description: `Precio actual: ${formatPrice(price)}`,
          });
        }
        return { ...alert, triggered: met };
      });
      return changed ? next : previous;
    });
  }, [priceById]);

  /* --------------------------------------------------------- UAP checks */

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const keywords = alertsRef.current.filter((alert): alert is UapAlert => alert.kind === "uap" && alert.active);
      if (keywords.length === 0) return;

      const rows = await fetchAllUapSightingsRows().catch(() => []);
      if (cancelled || rows.length === 0) return;

      setAlerts((previous) => {
        let changed = false;
        const next = previous.map((alert) => {
          if (alert.kind !== "uap" || !alert.active) return alert;
          const fresh = rows.filter((row) => !alert.seen.includes(row.id) && uapMatches(alert, row));
          if (fresh.length === 0) return alert;

          changed = true;
          const first = fresh[0];
          toast.info(`🛰️ ${alert.keyword}: ${first.location ?? "sin ubicación"}`, {
            description: (first.description ?? first.date_reported ?? "registro nuevo").slice(0, 140),
          });
          return {
            ...alert,
            triggered: true,
            seen: [...alert.seen, ...fresh.map((row) => row.id)].slice(-200),
          };
        });
        return changed ? next : previous;
      });
    };

    void run();
    const timer = setInterval(run, UAP_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  /* --------------------------------------------------------------- form */

  const openCreate = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((alert: Alert) => {
    setDraft(draftFromAlert(alert));
    setEditingId(alert.id);
    setFormError(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }, []);

  const submit = () => {
    const error = validateDraft(draft);
    if (error) {
      setFormError(error);
      return;
    }
    const existing = editingId ? alerts.find((alert) => alert.id === editingId) : undefined;
    const alert = alertFromDraft(draft, existing);
    setAlerts((previous) => upsertAlert(previous, alert));
    toast.success(editingId ? "Alerta actualizada" : "Alerta creada");
    closeForm();
  };

  const toggleAlert = (id: string) => {
    setAlerts((previous) =>
      previous.map((alert) =>
        alert.id === id ? { ...alert, active: !alert.active, triggered: false } : alert,
      ),
    );
  };

  const removeAlert = (id: string) => {
    setAlerts((previous) => previous.filter((alert) => alert.id !== id));
    if (editingId === id) closeForm();
  };

  const activeCount = alerts.filter((alert) => alert.active).length;
  const triggeredCount = alerts.filter((alert) => alert.triggered).length;
  const preview = validateDraft(draft) === null ? describeAlert(alertFromDraft(draft)) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-sm uppercase tracking-wider text-primary">Alertas</h2>
        <span className="font-mono text-[9px] text-muted-foreground/60">
          {activeCount} activas · {triggeredCount} disparadas
        </span>
        <Button variant="outline" size="sm" className="ml-auto h-7 text-[10px]" onClick={formOpen ? closeForm : openCreate}>
          {formOpen ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
          {formOpen ? "Cancelar" : "Nueva alerta"}
        </Button>
      </div>

      {formOpen && (
        <form
          className="mb-4 space-y-2 rounded-lg border border-border/30 bg-card/60 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-wrap gap-1" role="group" aria-label="Tipo de alerta">
            {(
              [
                { id: "price", label: "Precio", icon: TrendingUp },
                { id: "uap", label: "Avistamiento UAP", icon: AlertTriangle },
              ] as { id: AlertKind; label: string; icon: typeof TrendingUp }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDraft((current) => ({ ...current, kind: id }));
                  setFormError(null);
                }}
                aria-pressed={draft.kind === id}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-wider transition-colors ${
                  draft.kind === id
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {draft.kind === "price" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="alert-coin">
                Moneda
              </label>
              <select
                id="alert-coin"
                value={draft.coinId}
                onChange={(event) => setDraft((current) => ({ ...current, coinId: event.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:w-44"
              >
                {ALERT_COINS.map((coin) => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name} ({coin.symbol})
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="alert-direction">
                Condición
              </label>
              <select
                id="alert-direction"
                value={draft.direction}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, direction: event.target.value === "below" ? "below" : "above" }))
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:w-36"
              >
                <option value="above">Por encima de</option>
                <option value="below">Por debajo de</option>
              </select>
              <Input
                aria-label="Umbral en dólares"
                inputMode="decimal"
                placeholder="Umbral en USD"
                value={draft.threshold}
                onChange={(event) => setDraft((current) => ({ ...current, threshold: event.target.value }))}
                className="h-8 flex-1 text-xs"
              />
            </div>
          ) : (
            <Input
              aria-label="Palabra clave del avistamiento"
              placeholder="Palabra clave: volcán, orbe, triángulo…"
              value={draft.keyword}
              onChange={(event) => setDraft((current) => ({ ...current, keyword: event.target.value }))}
              className="h-8 text-xs"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-[180px] flex-1 font-mono text-[9px] text-muted-foreground/60">
              {formError ? (
                <span className="text-destructive" role="alert">
                  {formError}
                </span>
              ) : preview ? (
                <>Se guardará como: {preview}</>
              ) : (
                "Completa los campos para ver la alerta."
              )}
            </p>
            <Button type="submit" size="sm" className="h-8 text-[10px]">
              {editingId ? "Guardar cambios" : "Crear alerta"}
            </Button>
          </div>
        </form>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="py-10 text-center text-[11px] text-muted-foreground/50">
            Todavía no hay alertas. Crea una de precio (BTC, ETH…) o una de avistamientos por palabra clave.
          </p>
        ) : (
          alerts.map((alert) => {
            const Icon = alert.kind === "price" ? TrendingUp : AlertTriangle;
            const price = alert.kind === "price" ? priceById.get(alert.coinId) : undefined;
            const distance =
              alert.kind === "price" && price !== undefined && alert.threshold > 0
                ? ((price - alert.threshold) / alert.threshold) * 100
                : null;

            return (
              <div
                key={alert.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                  alert.triggered
                    ? "border-secondary/40 bg-secondary/5"
                    : alert.active
                      ? "border-primary/20 bg-card/60"
                      : "border-border/10 bg-card/30 opacity-60"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${alert.kind === "price" ? "text-secondary" : "text-destructive/80"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground/90">{describeAlert(alert)}</span>
                    {alert.triggered && (
                      <Badge
                        variant="outline"
                        className="h-3.5 animate-pulse border-secondary/30 px-1 py-0 text-[7px] text-secondary"
                      >
                        DISPARADA
                      </Badge>
                    )}
                    {!alert.active && (
                      <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/50">
                        en pausa
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground/55">
                    {alert.kind === "price" ? (
                      <>
                        {price !== undefined ? `Ahora ${formatPrice(price)}` : "esperando precio…"}
                        {distance !== null && (
                          <>
                            {" · "}
                            {Math.abs(distance).toFixed(1)}% {distance >= 0 ? "por encima" : "por debajo"} del umbral
                          </>
                        )}
                      </>
                    ) : (
                      <>Vigila el registro de anomalías · {alert.seen.length} notificados</>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-muted-foreground/60 hover:text-foreground"
                    onClick={() => openEdit(alert)}
                    aria-label={`Editar ${describeAlert(alert)}`}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => toggleAlert(alert.id)}
                    aria-pressed={alert.active}
                    aria-label={alert.active ? `Pausar ${describeAlert(alert)}` : `Activar ${describeAlert(alert)}`}
                    className={`h-4 w-8 rounded-full transition-colors ${alert.active ? "bg-primary" : "bg-muted/40"}`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full bg-background transition-transform ${
                        alert.active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive/60 hover:text-destructive"
                    onClick={() => removeAlert(alert.id)}
                    aria-label={`Eliminar ${describeAlert(alert)}`}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-center font-mono text-[9px] text-muted-foreground/40">
        Precio: CoinGecko cada 60 s · Avistamientos: registro UAP cada 5 min · Las alertas se guardan en este navegador
        ({ALERT_COINS.length} monedas disponibles).
      </p>
    </div>
  );
}
