import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Congela las cabeceras CSP de `vercel.json`.
 *
 * La política del sitio decide qué puede cargar la página y vive en un JSON que
 * nadie compila: un `;` de menos o una directiva borrada no rompen el build, se
 * descubren en producción cuando algo deja de cargar. Y el modo informe sólo
 * sirve si mide lo mismo que luego va a bloquear: en cuanto las dos políticas se
 * separan, el informe deja de predecir el bloqueo y la decisión de qué origen
 * sobra se toma con números que no son los del bloqueo.
 *
 * El test fija cuatro cosas:
 *
 *  1. Las directivas de cada política, por nombre. Quitar una o colar una nueva
 *     obliga a tocar este fichero: el cambio tiene que ser una decisión.
 *  2. Que el cableado de informes esté entero o no esté. `report-uri`,
 *     `report-to` y `Reporting-Endpoints` aparecen juntos y apuntan al mismo
 *     colector; media instalación es peor que ninguna, porque el log se queda
 *     vacío y no se nota.
 *  3. Que una directiva presente en las dos políticas tenga los mismos orígenes.
 *  4. Que un solo bloque de cabeceras declare CSP, y para la misma fuente.
 *
 * Hoy `main` tiene la política de bloqueo y ningún modo informe (llega con
 * #168). Por eso la mitad de informes no exige que la cabecera exista —no puede—
 * pero sí exige que, si existe algo del cableado, esté todo. Esa mitad se
 * ejercita al final con los valores reales de #168, para que no quede sin probar
 * mientras la cabecera no está desplegada, y en cuanto entre se aplica sola al
 * fichero de verdad.
 */

const CABECERA_BLOQUEO = "Content-Security-Policy";
const CABECERA_INFORME = "Content-Security-Policy-Report-Only";
const CABECERA_ENDPOINTS = "Reporting-Endpoints";

/**
 * Las directivas congeladas de la política que bloquea. Son las de `main`: un
 * endurecimiento mínimo que no depende de medir nada.
 */
const DIRECTIVAS_BLOQUEO = ["frame-ancestors", "object-src", "base-uri", "upgrade-insecure-requests"];

/**
 * Las del modo informe, con lo que mide #168. Se espera que crezcan —cada cosa
 * que se mida es una directiva más—, y el test obliga a que crezcan a la vista.
 */
const DIRECTIVAS_INFORME = ["default-src", "script-src"];

/**
 * Las del cableado. No son «directivas de la política» que se congelen por
 * nombre: lo que importa es a dónde apuntan, y eso se comprueba aparte. Si
 * entraran en la lista de sobrantes, el circuito completo saldría mal.
 */
const DIRECTIVAS_DE_CABLEADO = ["report-uri", "report-to"];

/** El colector y el grupo que lo declara: los dos lados del cableado. */
const COLECTOR = "/api/csp-report";
const GRUPO = "csp";

type Politicas = {
  bloqueo: string | null;
  informe: string | null;
  endpoints: string | null;
  fuentesConCsp: string[];
};

type Bloque = { source?: string; headers?: { key?: string; value?: string }[] };

function cabecerasDeVercel(vercel: unknown): Politicas {
  const salida: Politicas = { bloqueo: null, informe: null, endpoints: null, fuentesConCsp: [] };
  const bloques = (vercel as { headers?: Bloque[] }).headers;
  if (!Array.isArray(bloques)) return salida;

  for (const bloque of bloques) {
    const cabeceras = (bloque.headers ?? []).filter((cabecera) =>
      [CABECERA_BLOQUEO, CABECERA_INFORME, CABECERA_ENDPOINTS].includes(cabecera.key ?? ""),
    );
    if (cabeceras.length === 0) continue;

    salida.fuentesConCsp.push(bloque.source ?? "(sin source)");
    for (const cabecera of cabeceras) {
      if (cabecera.key === CABECERA_BLOQUEO) salida.bloqueo = cabecera.value ?? "";
      if (cabecera.key === CABECERA_INFORME) salida.informe = cabecera.value ?? "";
      if (cabecera.key === CABECERA_ENDPOINTS) salida.endpoints = cabecera.value ?? "";
    }
  }

  return salida;
}

function trozosDe(politica: string): string[] {
  return politica
    .split(";")
    .map((trozo) => trozo.trim())
    .filter(Boolean);
}

function nombresDe(politica: string): string[] {
  return trozosDe(politica).map((trozo) => trozo.split(/\s+/)[0].toLowerCase());
}

function directivasDe(politica: string): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const trozo of trozosDe(politica)) {
    const [nombre, ...valores] = trozo.split(/\s+/);
    salida[nombre.toLowerCase()] = valores;
  }
  return salida;
}

/** `csp="/api/csp-report"`, o varios grupos separados por comas. */
function gruposDeEndpoints(valor: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const trozo of valor.split(",")) {
    const encontrado = /^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"\s*$/.exec(trozo);
    if (encontrado) salida[encontrado[1].toLowerCase()] = encontrado[2];
  }
  return salida;
}

function faltantes(politica: Record<string, unknown>, esperadas: string[], etiqueta: string): string[] {
  return esperadas
    .filter((nombre) => !(nombre in politica))
    .map((nombre) => `la política de ${etiqueta} no declara ${nombre}`);
}

function sobrantes(politica: Record<string, unknown>, esperadas: string[], etiqueta: string): string[] {
  return Object.keys(politica)
    .filter((nombre) => !esperadas.includes(nombre))
    .map((nombre) => `la política de ${etiqueta} declara ${nombre}, que no está en la lista congelada`);
}

function repetidas(politica: string, etiqueta: string): string[] {
  const vistas = new Set<string>();
  const problemas: string[] = [];

  for (const nombre of nombresDe(politica)) {
    if (vistas.has(nombre)) problemas.push(`la política de ${etiqueta} repite ${nombre}`);
    vistas.add(nombre);
  }

  return problemas;
}

function vacias(politica: Record<string, string[]>, etiqueta: string): string[] {
  return Object.entries(politica)
    .filter(([, valores]) => valores.length === 0)
    .map(([nombre]) => `${nombre} no tiene valores en la política de ${etiqueta}`);
}

/** El orden y las mayúsculas no cambian los orígenes; el conjunto sí. */
function mismosOrigenes(uno: string[], otro: string[]): boolean {
  const normalizar = (valores: string[]) =>
    [...new Set(valores.map((valor) => valor.toLowerCase()))].sort().join(" ");
  return normalizar(uno) === normalizar(otro);
}

function problemasDe(politicas: Politicas): string[] {
  const problemas: string[] = [];

  if (politicas.fuentesConCsp.length !== 1) {
    problemas.push(
      `el CSP se declara en ${politicas.fuentesConCsp.length} bloques de cabeceras (${politicas.fuentesConCsp.join(", ")}); tiene que ser uno`,
    );
  }

  if (!politicas.bloqueo) return [...problemas, `falta ${CABECERA_BLOQUEO}`];

  const bloqueo = directivasDe(politicas.bloqueo);
  problemas.push(
    ...faltantes(bloqueo, DIRECTIVAS_BLOQUEO, "bloqueo"),
    ...sobrantes(bloqueo, DIRECTIVAS_BLOQUEO, "bloqueo"),
    ...repetidas(politicas.bloqueo, "bloqueo"),
    ...vacias(bloqueo, "bloqueo"),
  );

  // O no hay circuito de informes, o está entero. La condición mira las tres
  // piezas y también la de bloqueo: un `report-uri` ahí solo es media
  // instalación, y es justo la que deja el log vacío sin avisar.
  const informaAlguna =
    Boolean(politicas.informe || politicas.endpoints) ||
    "report-uri" in bloqueo ||
    "report-to" in bloqueo;
  if (!informaAlguna) return problemas;

  if (!politicas.informe) problemas.push(`hay cableado de informes pero falta ${CABECERA_INFORME}`);
  if (!politicas.endpoints) problemas.push(`hay cableado de informes pero falta ${CABECERA_ENDPOINTS}`);
  if (!politicas.informe || !politicas.endpoints) return problemas;

  const informe = directivasDe(politicas.informe);
  problemas.push(
    ...faltantes(informe, DIRECTIVAS_INFORME, "informe"),
    ...sobrantes(informe, [...DIRECTIVAS_INFORME, ...DIRECTIVAS_DE_CABLEADO], "informe"),
    ...repetidas(politicas.informe, "informe"),
    ...vacias(informe, "informe"),
  );

  const grupos = gruposDeEndpoints(politicas.endpoints);
  if (grupos[GRUPO] !== COLECTOR) {
    problemas.push(
      `${CABECERA_ENDPOINTS} declara ${GRUPO}="${grupos[GRUPO] ?? "(nada)"}", que no es ${COLECTOR}`,
    );
  }

  const reportTo = informe["report-to"]?.join(" ");
  if (reportTo !== GRUPO) {
    problemas.push(`la política de informe manda a report-to=${reportTo ?? "(nada)"}, que no es el grupo ${GRUPO}`);
  }

  const reportUri = informe["report-uri"]?.join(" ");
  if (reportUri !== COLECTOR) {
    problemas.push(`la política de informe manda a report-uri=${reportUri ?? "(nada)"}, que no es ${COLECTOR}`);
  }

  if ("report-uri" in bloqueo || "report-to" in bloqueo) {
    problemas.push("la política de bloqueo declara el cableado de informes; eso va en la de informe");
  }

  // Mismo nombre en las dos políticas ⇒ mismos orígenes. Es la comprobación que
  // hace que el informe sirva para decidir el bloqueo.
  for (const [nombre, valores] of Object.entries(informe)) {
    if (!(nombre in bloqueo)) continue;
    if (!mismosOrigenes(valores, bloqueo[nombre])) {
      problemas.push(
        `${nombre} difiere entre bloqueo e informe: ${bloqueo[nombre].join(" ")} ≠ ${valores.join(" ")}`,
      );
    }
  }

  return problemas;
}

// vitest corre desde la raíz del proyecto, y con `environment: "jsdom"`
// `import.meta.url` deja de ser `file:` (`readFileSync` rechaza un `http:`), así
// que el fichero se resuelve desde el cwd.
const vercel: unknown = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
const politicas = cabecerasDeVercel(vercel);

describe("CSP de vercel.json", () => {
  it("declara la política de bloqueo, con una sola fuente y sin problemas", () => {
    expect(politicas.bloqueo).toBeTruthy();
    expect(problemasDe(politicas)).toEqual([]);
  });

  it("congela las directivas de la política de bloqueo", () => {
    expect(Object.keys(directivasDe(politicas.bloqueo ?? "")).sort()).toEqual(
      [...DIRECTIVAS_BLOQUEO].sort(),
    );
  });

  it("un solo bloque de cabeceras declara CSP, y es el global", () => {
    expect(politicas.fuentesConCsp).toEqual(["/(.*)"]);
  });
});

/**
 * Las cabeceras que trae #168, copiadas de su `vercel.json`. La mitad de
 * informes del test no puede mirar el fichero real mientras la cabecera no esté
 * en `main`, así que se prueba aquí: con estos valores el circuito está entero y
 * no debe salir ningún problema, y con un cambio de cada tipo debe salir uno.
 */
const BLOQUEO_DE_MAIN =
  "frame-ancestors 'self' https://alienflow.space https://www.alienflow.space; object-src 'none'; base-uri 'self'; upgrade-insecure-requests";

const INFORME_DE_168 = [
  "default-src 'self' 'unsafe-inline' data: blob: https://*.supabase.co wss://*.supabase.co https://api.coingecko.com https://unpkg.com https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://api.gdeltproject.org https://*.vercel-insights.com https://va.vercel-scripts.com https://fonts.googleapis.com https://fonts.gstatic.com https://fonts.cdnfonts.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://telegram.org https://unpkg.com https://va.vercel-scripts.com",
  `report-uri ${COLECTOR}`,
  `report-to ${GRUPO}`,
].join("; ");

const ENDPOINTS_DE_168 = `${GRUPO}="${COLECTOR}"`;

const conInforme = (cambios: Partial<Politicas> = {}): Politicas => ({
  bloqueo: BLOQUEO_DE_MAIN,
  informe: INFORME_DE_168,
  endpoints: ENDPOINTS_DE_168,
  fuentesConCsp: ["/(.*)"],
  ...cambios,
});

describe("el circuito de informes de #168", () => {
  it("entero: bloqueo, informe, report-uri, report-to y Reporting-Endpoints", () => {
    expect(problemasDe(conInforme())).toEqual([]);
  });

  it("report-uri y report-to apuntando a otro sitio son un problema", () => {
    const otroUri = problemasDe(
      conInforme({ informe: INFORME_DE_168.replace(`report-uri ${COLECTOR}`, "report-uri /api/otro") }),
    );
    expect(otroUri.some((problema) => problema.includes("report-uri=/api/otro"))).toBe(true);

    const otroGrupo = problemasDe(
      conInforme({ informe: INFORME_DE_168.replace(`report-to ${GRUPO}`, "report-to otro") }),
    );
    expect(otroGrupo.some((problema) => problema.includes("report-to=otro"))).toBe(true);
  });

  it("Reporting-Endpoints que no declara el grupo, o que lo apunta a otro colector", () => {
    const sinGrupo = problemasDe(conInforme({ endpoints: 'informe="/api/csp-report"' }));
    expect(sinGrupo.some((problema) => problema.includes("no es /api/csp-report"))).toBe(true);

    const otroColector = problemasDe(conInforme({ endpoints: 'csp="/api/otro"' }));
    expect(otroColector.some((problema) => problema.includes('csp="/api/otro"'))).toBe(true);
  });

  it("media instalación también es un problema: la cabecera de informe sin endpoints", () => {
    const problemas = problemasDe(conInforme({ endpoints: null }));
    expect(problemas.some((problema) => problema.includes(CABECERA_ENDPOINTS))).toBe(true);
  });

  it("una directiva compartida con orígenes distintos es divergencia", () => {
    const problemas = problemasDe(
      conInforme({
        bloqueo: `${BLOQUEO_DE_MAIN}; script-src 'self'`,
      }),
    );
    expect(problemas.some((problema) => problema.includes("script-src difiere entre bloqueo e informe"))).toBe(
      true,
    );
  });

  it("los mismos orígenes en otro orden no son divergencia", () => {
    const problemas = problemasDe(
      conInforme({
        bloqueo: `${BLOQUEO_DE_MAIN}; script-src https://unpkg.com 'self'`,
        informe: INFORME_DE_168.replace(
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://telegram.org https://unpkg.com https://va.vercel-scripts.com",
          "script-src 'self' https://unpkg.com",
        ),
      }),
    );
    expect(problemas.some((problema) => problema.includes("difiere"))).toBe(false);
  });

  it("una directiva del cableado metida en la política que bloquea es media instalación", () => {
    const problemas = problemasDe(
      conInforme({
        bloqueo: BLOQUEO_DE_MAIN.replace(
          "upgrade-insecure-requests",
          "upgrade-insecure-requests; report-uri /api/csp-report",
        ),
      }),
    );
    expect(problemas.some((problema) => problema.includes("la política de bloqueo declara el cableado"))).toBe(
      true,
    );
  });

  it("una directiva vacía o repetida no pasa", () => {
    const vacia = problemasDe(conInforme({ bloqueo: `${BLOQUEO_DE_MAIN}; report-uri` }));
    expect(vacia.some((problema) => problema.includes("report-uri no tiene valores"))).toBe(true);

    const repetida = problemasDe(conInforme({ bloqueo: `${BLOQUEO_DE_MAIN}; base-uri 'none'` }));
    expect(repetida.some((problema) => problema.includes("repite base-uri"))).toBe(true);
  });
});
