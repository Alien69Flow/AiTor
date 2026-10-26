/**
 * Turns the measured sign-in states into a pass/fail decision for CI.
 *
 * The distinction that matters: a provider that was never switched on is a
 * *choice* (the button is hidden on purpose), while a provider that is switched
 * on without a Client ID + Secret is a *broken promise* — the login page offers
 * it, the browser goes through Supabase, and GoTrue answers
 * `400 Unsupported provider: missing OAuth secret`. That is exactly how Google
 * and Apple broke when the Lovable broker was replaced in f45353c, and nothing
 * noticed for a day.
 *
 * So the gate fails on:
 *   - missing-secret  an enabled provider with no credentials
 *   - expired-ack     an exception in the baseline that has run out
 *   - probe-error     a provider that answered something we cannot explain
 *
 * and only warns on:
 *   - acknowledged    an unexpired, explicitly recorded exception
 *   - stale-ack       an exception for a provider that now works
 *   - unknown-ack     a baseline entry for a provider the app no longer offers
 *
 * The baseline exists so the gate can be blocking today without painting the
 * whole repo red for a state the owner already knows about. It expires, so
 * "later" cannot become "never": when the date passes, CI fails until the
 * secret is saved or the deadline is consciously extended.
 */

/** @typedef {{ id: string, label: string, panel: string }} Method */
/** @typedef {{ method: Method, result: { state: string, detail: string } }} Row */
/** @typedef {{ providers?: Record<string, { expires: string, reason?: string }> }} Baseline */

const MISSING_SECRET = "sin-credenciales";
const DAY = 86_400_000;

function daysLeft(from, to) {
  return Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/**
 * @param {{ rows: Row[], baseline?: Baseline, today: string }} input
 *   `today` is an ISO date (YYYY-MM-DD) so the decision is a pure function of
 *   its arguments and a test can move the clock instead of waiting a month.
 */
export function evaluateGate({ rows, baseline = {}, today }) {
  const acknowledged = baseline.providers ?? {};
  const failures = [];
  const warnings = [];
  const seen = new Set();

  for (const { method, result } of rows) {
    const ack = acknowledged[method.id];
    if (ack) seen.add(method.id);

    if (result.state === MISSING_SECRET) {
      if (!ack) {
        failures.push({
          kind: "missing-secret",
          id: method.id,
          label: method.label,
          panel: method.panel,
          message: `encendido sin Client ID + Secret: el servidor responde 400 y el botón no inicia sesión · ${method.panel}`,
        });
      } else if (ack.expires < today) {
        failures.push({
          kind: "expired-ack",
          id: method.id,
          label: method.label,
          panel: method.panel,
          message: `la excepción caducó el ${ack.expires} y sigue sin credenciales · ${method.panel}`,
        });
      } else {
        warnings.push({
          kind: "acknowledged",
          id: method.id,
          label: method.label,
          message: `pendiente por decisión, vence en ${daysLeft(today, ack.expires)} días (${ack.expires})${
            ack.reason ? ` · ${ack.reason}` : ""
          }`,
        });
      }
    } else if (result.state === "error") {
      failures.push({
        kind: "probe-error",
        id: method.id,
        label: method.label,
        panel: method.panel,
        message: `no se pudo medir: ${result.detail}`,
      });
    } else if (result.state === "ready" && ack) {
      warnings.push({
        kind: "stale-ack",
        id: method.id,
        label: method.label,
        message: "ya responde: borra su entrada del baseline para que el gate vuelva a vigilarlo",
      });
    }
  }

  for (const id of Object.keys(acknowledged)) {
    if (seen.has(id)) continue;
    warnings.push({
      kind: "unknown-ack",
      id,
      label: id,
      message: "el baseline menciona un proveedor que la app ya no ofrece",
    });
  }

  return { ok: failures.length === 0, failures, warnings };
}
