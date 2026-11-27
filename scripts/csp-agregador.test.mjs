import { describe, expect, it } from "vitest";
import {
  agregar,
  informesDeLineas,
  lineasDeLog,
  origen,
  parseInforme,
  trocear,
} from "./csp-agregador.mjs";

/**
 * El agregador traduce líneas de log a filas de `csp_reports_daily`. Si lee mal
 * una línea, la tabla miente sobre qué orígenes usa el sitio, y la decisión de
 * qué quitar de la política se toma con esos números. Aquí se fija la lectura,
 * el recorte a origen y la suma, sin red y sin base de datos.
 */

describe("parseInforme", () => {
  it("lee la línea del contrato del colector", () => {
    expect(
      parseInforme(
        "[csp-report] directive=connect-src blocked=https://api.coingecko.com/api document=https://aitor.alienflow.space disposition=report count=3",
      ),
    ).toEqual({
      directiva: "connect-src",
      blocked: "https://api.coingecko.com/api",
      document: "https://aitor.alienflow.space",
      disposition: "report",
      count: 3,
    });
  });

  it("acepta los campos vacíos que escribe el colector como guion", () => {
    const informe = parseInforme(
      "[csp-report] directive=img-src blocked=- document=- disposition=- count=1",
    );
    expect(informe).toMatchObject({ blocked: "-", document: "-", disposition: "-" });
  });

  it("no inventa un informe donde no lo hay", () => {
    expect(parseInforme("hola")).toBeNull();
    expect(parseInforme("[csp-report] directive=img-src count=1")).toBeNull();
    expect(parseInforme("")).toBeNull();
    expect(parseInforme(null)).toBeNull();
  });

  it("encuentra la línea aunque venga envuelta por el CLI", () => {
    const informe = parseInforme(
      "2026-11-27T10:00:00Z  [csp-report] directive=font-src blocked=https://fonts.gstatic.com/s/x.woff2 document=- disposition=report count=1",
    );
    expect(informe?.directiva).toBe("font-src");
  });
});

describe("origen", () => {
  it("recorta una URL a su origen, que es lo que se agrega", () => {
    expect(origen("https://cdn.example/x.js?a=1#f")).toBe("https://cdn.example");
    expect(origen("https://cdn.example:8443/x.js")).toBe("https://cdn.example:8443");
  });

  it("deja tal cual lo que no es una URL: es justo lo que hay que arreglar", () => {
    expect(origen("inline")).toBe("inline");
    expect(origen("eval")).toBe("eval");
    expect(origen("- ")).toBe("-");
    expect(origen("")).toBe("-");
  });

  it("corta al tope de la columna en vez de romper el insert", () => {
    const largo = `https://x.example/${"a".repeat(1000)}`;
    expect(origen(largo)).toBe("https://x.example");
    expect(origen("data:" + "b".repeat(1000)).length).toBe(512);
  });
});

describe("agregar", () => {
  const dia = (hora) => new Date(`2026-11-27T${hora}:00:00.000Z`);

  it("suma el count de la misma clave y guarda la ventana", () => {
    const filas = agregar([
      { directiva: "img-src", blocked: "https://x.example/a.png", document: "https://aitor.alienflow.space", count: 3, cuando: dia("08") },
      { directiva: "img-src", blocked: "https://x.example/b.png", document: "https://aitor.alienflow.space", count: 2, cuando: dia("17") },
    ]);

    expect(filas).toEqual([
      {
        dia: "2026-11-27",
        directiva: "img-src",
        blocked_origen: "https://x.example",
        document_origen: "https://aitor.alienflow.space",
        count: 5,
        first_seen: "2026-11-27T08:00:00.000Z",
        last_seen: "2026-11-27T17:00:00.000Z",
      },
    ]);
  });

  it("separa por día: una fila no puede empezar un día y acabar en otro", () => {
    const filas = agregar([
      { directiva: "img-src", blocked: "https://x.example/a.png", document: "-", count: 1, cuando: dia("23") },
      { directiva: "img-src", blocked: "https://x.example/a.png", document: "-", count: 1, cuando: new Date("2026-11-28T00:10:00.000Z") },
    ]);

    expect(filas.map((fila) => fila.dia)).toEqual(["2026-11-27", "2026-11-28"]);
    expect(filas.every((fila) => fila.first_seen.slice(0, 10) === fila.dia)).toBe(true);
  });

  it("separa por directiva y por origen del documento", () => {
    const filas = agregar([
      { directiva: "img-src", blocked: "https://x.example/a.png", document: "https://aitor.alienflow.space", count: 1, cuando: dia("09") },
      { directiva: "font-src", blocked: "https://x.example/a.png", document: "https://aitor.alienflow.space", count: 1, cuando: dia("09") },
      { directiva: "img-src", blocked: "https://x.example/a.png", document: "https://aitor.alienflow.space/hub", count: 1, cuando: dia("09") },
    ]);

    expect(filas).toHaveLength(2);
    expect(filas.map((fila) => fila.document_origen)).toEqual([
      "https://aitor.alienflow.space",
      "https://aitor.alienflow.space",
    ]);
  });

  it("descarta lo que no tiene fecha válida en vez de inventarse un día", () => {
    expect(
      agregar([
        { directiva: "img-src", blocked: "- ", document: "-", count: 1, cuando: new Date("no") },
        { directiva: "img-src", blocked: "-", document: "-", count: 1, cuando: null },
      ]),
    ).toEqual([]);
  });
});

describe("líneas de log a informes", () => {
  it("lee el JSON del CLI y se queda con el mensaje y la fecha", () => {
    const salida = [
      JSON.stringify({
        message: "[csp-report] directive=img-src blocked=https://x.example/a.png document=- disposition=report count=1",
        timestamp: Date.parse("2026-11-27T10:00:00.000Z"),
      }),
      JSON.stringify({ message: "otra cosa del log", timestamp: Date.parse("2026-11-27T10:01:00.000Z") }),
    ].join("\n");

    const { entradas, sinFecha } = informesDeLineas(lineasDeLog(salida));

    expect(sinFecha).toBe(0);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ directiva: "img-src", count: 1 });
    expect(entradas[0].cuando.toISOString()).toBe("2026-11-27T10:00:00.000Z");
  });

  it("una línea sin fecha no se pierde: se cuenta hoy y se dice cuántas", () => {
    const ahora = new Date("2026-11-27T12:00:00.000Z");
    const { entradas, sinFecha } = informesDeLineas(
      [{ mensaje: "[csp-report] directive=img-src blocked=- document=- disposition=- count=1", cuando: null }],
      ahora,
    );

    expect(sinFecha).toBe(1);
    expect(entradas[0].cuando).toBe(ahora);
  });

  it("el texto plano del CLI no rompe nada", () => {
    const lineas = lineasDeLog("aviso: nada que leer\n\n");
    expect(lineas).toHaveLength(1);
    expect(lineas[0].cuando).toBeNull();
    expect(informesDeLineas(lineas).entradas).toEqual([]);
  });
});

describe("trocear", () => {
  it("parte en lotes del tamaño que acepta el RPC", () => {
    expect(trocear(new Array(501).fill(0)).map((lote) => lote.length)).toEqual([500, 1]);
    expect(trocear([])).toEqual([]);
  });
});
