import { describe, expect, it } from "vitest";
import { FIRECRAWL_BASE, webResults } from "../../../supabase/functions/_shared/firecrawl";

/**
 * Firecrawl v2 mueve los resultados de búsqueda de `data` a `data.web`.
 * Ese cambio no da error: devuelve una lista vacía y el feed se queda mudo. El
 * normalizador es lo único que impide ese fallo silencioso, así que se fija
 * aquí con las dos formas de respuesta.
 */

describe("respuesta de búsqueda de Firecrawl", () => {
  it("lee los resultados de v2 en data.web", () => {
    const payload = {
      success: true,
      data: { web: [{ url: "https://a.example", title: "A" }, { url: "https://b.example" }] },
    };
    expect(webResults(payload)).toHaveLength(2);
    expect(webResults(payload)[0].title).toBe("A");
  });

  it("sigue leyendo la forma de v1 (data como array)", () => {
    const payload = { success: true, data: [{ url: "https://a.example" }] };
    expect(webResults(payload)).toHaveLength(1);
  });

  it("no inventa resultados cuando la respuesta no trae lista", () => {
    expect(webResults({ success: true, data: { news: [] } })).toEqual([]);
    expect(webResults({ success: false, error: "nope" })).toEqual([]);
    expect(webResults(null)).toEqual([]);
    expect(webResults(undefined)).toEqual([]);
    expect(webResults("texto")).toEqual([]);
  });

  it("apunta a la v2, que es la que sobrevive al 10 de diciembre de 2026", () => {
    expect(FIRECRAWL_BASE).toBe("https://api.firecrawl.dev/v2");
  });
});
