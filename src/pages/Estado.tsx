import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HEALTH_ENDPOINT,
  formatAge,
  readHealth,
  type HealthRead,
  type HealthVerdict,
  type UpstreamStatus,
} from "@/services/health-status";

/**
 * Página pública de estado.
 *
 * Lee la vista compacta de `/api/health`, que es la que se puede publicar: no
 * trae claves, ni detalles privados, ni umbrales. Si la lectura falla, la
 * página no enseña un veredicto inventado: dice que no hay datos y por qué.
 * Todo lo que aparece aquí viene de esa respuesta; no hay cifras de adorno.
 */

const VERDICT: Record<
  HealthVerdict,
  { title: string; description: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  HEALTHY: {
    title: "Sano",
    description: "Los conjuntos de datos que se vigilan están dentro de su ventana de frescura.",
    badge: "default",
  },
  DEGRADED: {
    title: "Degradado",
    description: "Responde, pero hay algún conjunto vacío o con datos más viejos de lo permitido.",
    badge: "secondary",
  },
  UNHEALTHY: {
    title: "Con fallos",
    description: "Algún conjunto crítico no tiene datos. Lo que se ve en el panel puede estar incompleto.",
    badge: "destructive",
  },
  UNCONFIGURED: {
    title: "Sin configurar",
    description: "Este despliegue no tiene almacén, así que no hay nada que medir todavía.",
    badge: "outline",
  },
};

const UPSTREAM: Record<UpstreamStatus, { text: string; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  OK: { text: "responde", badge: "default" },
  DOWN: { text: "configurado y no responde", badge: "destructive" },
  UNCONFIGURED: { text: "sin configurar (no es un fallo)", badge: "outline" },
};

export default function Estado() {
  const [read, setRead] = useState<HealthRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    readHealth(fetch, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setRead(result);
        setLoading(false);
      })
      .catch(() => {
        // Abortado al desmontar o al pedir otra lectura: no es un estado.
      });
    return () => controller.abort();
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <>
      <Helmet>
        <title>Estado del sistema | Ai Tor</title>
        <meta
          name="description"
          content="Estado público de Ai Tor: veredicto de los datos, upstreams y frescura, leído de /api/health?compact=1."
        />
        <meta property="og:title" content="Estado del sistema | Ai Tor" />
        <meta
          property="og:description"
          content="Veredicto, upstreams y frescura de Ai Tor, sin claves ni detalles privados."
        />
      </Helmet>

      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Estado del sistema</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sale de <code className="rounded bg-muted px-1 py-0.5">{HEALTH_ENDPOINT}</code>, la vista
            pública: no incluye claves ni detalles internos.{" "}
            <Link to="/" className="text-primary underline hover:text-primary/90">
              Volver al terminal
            </Link>
          </p>
        </header>

        <div className="mb-4 flex items-center justify-between">
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {loading ? "Consultando…" : read ? "Última lectura completada." : "Sin lectura todavía."}
          </p>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Consultando…" : "Volver a consultar"}
          </Button>
        </div>

        {!read && loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Pidiendo el estado a <code>{HEALTH_ENDPOINT}</code>…
            </CardContent>
          </Card>
        ) : null}

        {read?.kind === "unavailable" ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Sin datos ahora mismo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{read.reason}</p>
              <p className="text-muted-foreground">
                No pinto un veredicto que no he podido leer. Si insiste, el servicio de salud está
                caído o la ruta no está desplegada en este dominio.
              </p>
              {read.code ? (
                <p className="text-xs">
                  Código del servidor: <code className="rounded bg-muted px-1 py-0.5">{read.code}</code>
                </p>
              ) : null}
              {read.requestId ? (
                <p className="text-xs">
                  Referencia:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{read.requestId}</code>
                </p>
              ) : null}
              {read.upstreams.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Upstreams que sí contestaron a esta comprobación
                  </p>
                  <ul className="space-y-1">
                    {read.upstreams.map((upstream) => (
                      <li key={upstream.key} className="flex items-center gap-2 text-sm">
                        <span>{upstream.label}</span>
                        <Badge variant={UPSTREAM[upstream.status].badge}>
                          {UPSTREAM[upstream.status].text}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {read?.kind === "ok" ? <HealthView snapshot={read.snapshot} /> : null}
      </main>
    </>
  );
}

function HealthView({ snapshot }: { snapshot: Extract<HealthRead, { kind: "ok" }>["snapshot"] }) {
  const verdict = VERDICT[snapshot.status];
  const checkedAt = new Date(snapshot.checkedAt);
  const age = formatAge(Date.parse(snapshot.checkedAt));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={verdict.badge}>{verdict.title}</Badge>
            <CardTitle className="text-base">{snapshot.status}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{verdict.description}</p>
          <p>
            Comprobado el{" "}
            <time dateTime={snapshot.checkedAt} title={snapshot.checkedAt}>
              {checkedAt.toLocaleString("es-ES")}
            </time>{" "}
            · <span className="text-muted-foreground">{age}</span>
          </p>
          <p className="text-xs text-muted-foreground">Estado de los datos: {snapshot.dataStatus}</p>
          {snapshot.detail ? (
            <p className="text-xs">
              Lo que falta en este despliegue:{" "}
              <code className="rounded bg-muted px-1 py-0.5">{snapshot.detail}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Frescura de los datos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {snapshot.summary ? (
            <ul className="space-y-1">
              <li>
                <strong>{snapshot.summary.ok}</strong> de {snapshot.summary.total} conjuntos dentro de
                su ventana
              </li>
              <li className={snapshot.summary.stale > 0 ? "text-foreground" : "text-muted-foreground"}>
                {snapshot.summary.stale} con datos más viejos de lo permitido
              </li>
              <li
                className={
                  snapshot.summary.empty + snapshot.summary.error > 0
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {snapshot.summary.empty + snapshot.summary.error} sin datos
              </li>
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No hay recuento que enseñar: sin almacén no se mide ninguna frescura.
            </p>
          )}
        </CardContent>
      </Card>

      {snapshot.problems.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conjuntos con problema</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {snapshot.problems.map((problem) => (
                <li key={`${problem.label}-${problem.status}`} className="flex flex-wrap gap-2">
                  <span>{problem.label}</span>
                  <span className="text-muted-foreground">{problem.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upstreams</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot.upstreams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              La respuesta no trajo ningún upstream; no hay nada que afirmar sobre ellos.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {snapshot.upstreams.map((upstream) => (
                <li key={upstream.key} className="flex flex-wrap items-center gap-2">
                  <span>{upstream.label}</span>
                  <Badge variant={UPSTREAM[upstream.status].badge}>
                    {UPSTREAM[upstream.status].text}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{upstream.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
