import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { gdeltUpstreamUrl, parseGdeltParams } from "../../api/gdelt";

/**
 * `/api/gdelt` nace de un diagnóstico que parecía CORS y no lo era: `DOC 2.0`
 * contesta 200 en HTML ante `format=geojson` (que no soporta) y `GEO 2.0`, la
 * que sí daba GeoJSON, responde 404. El proxy habla con `GKG v1`, comprobado
 * vivo, y estas pruebas fijan:
 *  - la URL que se pide (tema, ventana en minutos, campos mínimos);
 *  - que no es un proxy abierto: tema, horas y filas van validados;
 *  - que la respuesta se reetiqueta como JSON aunque llegue como geo+json;
 *  - que un 429 se explica con `retry-after` y no se cachea;
 *  - que el HTML de error no se guarda como si fuera un GeoJSON vacío;
 *  - que la segunda llamada idéntica sale de caché.
 */

interface Result {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function call(query: Record<string, string>, method = "GET"): Promise<Result> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const req = { method, query, headers: {} };
    const res = {
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload, headers });
      },
      end() {
        resolve({ status: this.statusCode, body: "", headers });
      },
    };
    void (handler as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  });
}

const geoJson = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      geometry: { coordinates: [30.52, 50.45] },
      properties: {
        name: "Kyiv",
        url: "https://a.example/1",
        domain: "a.example",
        urlpubtimedate: "2026-11-07T19:00:00Z",
        urltone: -8.2,
      },
    },
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validación de parámetros", () => {
  it("aplica los valores de la capa por defecto", () => {
    expect(parseGdeltParams({})).toEqual({
      ok: true,
      value: { theme: "ARMEDCONFLICT", hours: 12, maxrows: 250 },
    });
  });

  it("rechaza temas y ventanas que no son de la capa", () => {
    expect(parseGdeltParams({ theme: "armedconflict" }).ok).toBe(false);
    expect(parseGdeltParams({ theme: "ARMED CONFLICT" }).ok).toBe(false);
    expect(parseGdeltParams({ theme: "ARMEDCONFLICT;DROP" }).ok).toBe(false);
    expect(parseGdeltParams({ hours: "0" }).ok).toBe(false);
    expect(parseGdeltParams({ hours: "48" }).ok).toBe(false);
    expect(parseGdeltParams({ hours: "doce" }).ok).toBe(false);
    expect(parseGdeltParams({ maxrows: "0" }).ok).toBe(false);
  });

  it("corta las filas en el tope en vez de pasarlas a GDELT", () => {
    const parsed = parseGdeltParams({ maxrows: "999" });
    expect(parsed.ok && parsed.value.maxrows).toBe(500);
  });

  it("pide el GKG con la ventana en minutos y sólo los campos que se usan", () => {
    const parsed = parseGdeltParams({ theme: "ARMEDCONFLICT", hours: "6", maxrows: "80" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const url = new URL(gdeltUpstreamUrl(parsed.value));
    expect(url.origin + url.pathname).toBe("https://api.gdeltproject.org/api/v1/gkg_geojson");
    expect(url.searchParams.get("QUERY")).toBe("ARMEDCONFLICT");
    expect(url.searchParams.get("TIMESPAN")).toBe("360");
    expect(url.searchParams.get("MAXROWS")).toBe("80");
    expect(url.searchParams.get("OUTPUTFIELDS")).toContain("tone");
  });
});

describe("respuesta del proxy", () => {
  it("devuelve el GeoJSON reetiquetado como JSON", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(geoJson, { status: 200, headers: { "content-type": "application/vnd.geo+json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await call({ theme: "ARMEDCONFLICT", hours: "3", maxrows: "10" });
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("application/json");
    expect(result.headers["access-control-allow-origin"]).toBe("*");
    expect(JSON.parse(result.body).features).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("la segunda llamada idéntica sale de caché", async () => {
    const fetchMock = vi.fn(async () => new Response(geoJson, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const query = { theme: "ARMEDCONFLICT", hours: "4", maxrows: "20" };
    const first = await call(query);
    const second = await call(query);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers["x-aitor-cache"]).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un 429 se explica y no se cachea", async () => {
    const fetchMock = vi.fn(async () => new Response("slow down", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const query = { theme: "ARMEDCONFLICT", hours: "5", maxrows: "30" };
    const first = await call(query);
    expect(first.status).toBe(429);
    expect(first.headers["retry-after"]).toBe("20");
    expect(JSON.parse(first.body).error).toContain("5 s");

    await call(query);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("el HTML de error no se guarda como si fuera un GeoJSON vacío", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>bad query</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const query = { theme: "ARMEDCONFLICT", hours: "7", maxrows: "40" };
    const first = await call(query);
    expect(first.status).toBe(502);
    expect(JSON.parse(first.body).error).toContain("no devolvió JSON");

    await call(query);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un parámetro inválido se corta antes de salir a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await call({ theme: "not a theme" });
    expect(result.status).toBe(400);
    expect(JSON.parse(result.body).error).toContain("theme");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sólo acepta GET", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const result = await call({}, "POST");
    expect(result.status).toBe(405);
    expect(result.headers["allow"]).toBe("GET, OPTIONS");
  });
});
