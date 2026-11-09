#!/usr/bin/env node
/**
 * Hielo marino a AMSR2 25 km y, de paso, las dos pruebas del catálogo que
 * quedaron congeladas en el comportamiento anterior a #63 y #64.
 *
 * Sustituye capturando la sangría, así que no depende de la indentación exacta
 * del fichero. Todo o nada: si un ancla no aparece una sola vez, sale con 1 sin
 * escribir nada.
 *
 * Uso:  node scripts/globe-amsr2-patch.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

const LAYERS = "src/lib/globe-layers.ts";
const TEST = "src/lib/globe-layers.test.ts";
const AUDIT = "scripts/check-globe-layers.mjs";

const files = {
  [LAYERS]: readFileSync(LAYERS, "utf8"),
  [TEST]: readFileSync(TEST, "utf8"),
  [AUDIT]: readFileSync(AUDIT, "utf8"),
};

const checkOnly = process.argv.includes("--check");

/** Ya aplicado: el id nuevo está en el catálogo. */
if (files[LAYERS].includes("AMSRU2_Sea_Ice_Concentration_25km")) {
  console.log("El parche ya estaba aplicado; no se toca nada.");
  process.exit(0);
}

function swap(file, label, pattern, build) {
  const src = files[file];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = (src.match(new RegExp(pattern.source, flags)) ?? []).length;
  if (count !== 1) {
    throw new Error(`${file}: «${label}» aparece ${count} veces, se esperaba 1. No se escribe nada.`);
  }
  files[file] = src.replace(pattern, (...args) => build(args[0], args.slice(1, -2)));
  console.log(`OK   ${file} · ${label}`);
}

// ── Catálogo: el hielo marino pasa a AMSR2 25 km ──────────────────────────
swap(
  LAYERS,
  "fuente y frescura del hielo marino",
  /^([ \t]*)source: "NASA GIBS · VIIRS NOAA-21 \(diario\)",[ \t]*\r?\n[ \t]*freshness: "1 día",/m,
  (whole, [indent]) =>
    `${indent}source: "NASA GIBS · AMSR2/GCOM-W1, 25 km",\n` +
    `${indent}freshness: "Última pasada publicada",`,
);

swap(
  LAYERS,
  "descripción del hielo marino",
  /"Extensión de hielo marino de polo a polo, medida a 375 m"/,
  () => '"Concentración de hielo marino de polo a polo, medida cada día a 25 km"',
);

swap(
  LAYERS,
  "comentario del hielo marino",
  /^([ \t]*)\/\/ MUR deducía el hielo[^\n]*\n[ \t]*\/\/ el borde; VIIRS lo mide directamente todos los días\./m,
  (whole, [indent]) =>
    `${indent}// AMSR2 mide la concentración en una rejilla polar de 25 km. GIBS\n` +
    `${indent}// cerró la serie (ongoing: false), así que la capa va sin segmento TIME:\n` +
    `${indent}// pedirle la fecha de hoy responde 404 y, sin fecha, sirve la última pasada.`,
);

swap(
  LAYERS,
  "tesela del hielo marino",
  /^([ \t]*)gibs: \{ layer: "VIIRS_NOAA21_Sea_Ice"[^\n]*$/m,
  (whole, [indent]) =>
    `${indent}gibs: { layer: "AMSRU2_Sea_Ice_Concentration_25km", level: 6, alpha: 0.85, timeless: true },`,
);

// ── Pruebas: las dos que fijaban el comportamiento anterior ──────────────
swap(
  TEST,
  "prueba de las corrientes",
  /it\("las corrientes llevan fecha fija porque la serie de OSCAR está detenida", \(\) => \{[\s\S]*?\n  \}\);/m,
  () =>
    [
      'it("las corrientes piden el último compuesto, sin fecha fija", () => {',
      '    const currents = layerDef("oceanCurrents")?.gibs;',
      "    // OSCAR publica compuestos de 5 días: con un TIME diario GIBS responde 404,",
      "    // así que la capa va sin segmento temporal y sigue a la última pasada.",
      "    expect(currents?.timeless).toBe(true);",
      "    expect(currents?.date).toBeUndefined();",
      "  });",
      "",
      '  it("el hielo marino es AMSR2 a 25 km, sin fecha fija", () => {',
      '    const ice = layerDef("seaIce")?.gibs;',
      "    // AMSRU2_Sea_Ice_Concentration_25km es la rejilla polar de AMSR2 (GCOM-W1).",
      "    // GIBS ya no la actualiza, así que sin TIME sirve la última pasada: pedirle",
      "    // el día de hoy devolvería 404 y la capa parecería rota.",
      '    expect(ice?.layer).toBe("AMSRU2_Sea_Ice_Concentration_25km");',
      "    expect(ice?.timeless).toBe(true);",
      "    expect(ice?.date).toBeUndefined();",
      "    expect(ice?.dateOffsetHours).toBeUndefined();",
      "  });",
    ].join("\n"),
);

swap(
  TEST,
  "prueba de los cascarones atmosféricos",
  /it\("la capa existe, es opcional y no viene encendida", \(\) => \{[\s\S]*?\n  \}\);/m,
  () =>
    [
      'it("la capa existe y viene encendida junto a la atmósfera de Cesium", () => {',
      '    expect(layerDef("atmosphericShells")?.group).toBe("Atmospheric & Weather");',
      "    // #64 la encendió de serie: con sólo el halo, la escalera atmosférica no se",
      "    // podía ver desde fuera y el catálogo la anunciaba sin dibujarla.",
      '    expect(DEFAULT_ACTIVE_LAYERS).toContain("atmosphericShells");',
      "  });",
    ].join("\n"),
);

swap(
  TEST,
  "comentario de los cascarones",
  /Los cascarones son opcionales desde que el globo usa la atmósfera real de/,
  () => "Los cascarones se encienden junto a la atmósfera real de",
);

// ── Auditoría: sonda de tesela polar para comparar bytes ─────────────────
swap(
  AUDIT,
  "bucle de capas GIBS",
  /for \(const g of gibs\) \{[\s\S]*?\n\}\n/,
  () =>
    [
      "for (const g of gibs) {",
      '  const time = g.timeless ? "" : `${g.date ?? day(g.offset)}/`;',
      "  const base = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${g.layer}/default/${time}GoogleMapsCompatible_Level${g.level}`;",
      "  const r = await head(`${base}/3/3/4.png`);",
      "  // Sonda polar: la misma capa pedida sobre el Ártico (z=2, esquina 1/0).",
      "  // Comparar estos bytes con los de la tesela de referencia separa «la capa",
      "  // está rota» de «la capa existe pero no tiene datos en esa parte del mundo».",
      "  const polar = await head(`${base}/2/1/0.png`);",
      '  const isImage = Boolean(r.type?.startsWith("image")) && r.status === 200;',
      "  const empty = isImage && r.bytes < 1_500;",
      '  const polarImage = Boolean(polar.type?.startsWith("image")) && polar.status === 200;',
      "  const polarEmpty = polarImage && polar.bytes < 1_500;",
      "  const esPolar = /Sea_Ice|Snow_Cover|Ice_Surface/i.test(g.layer);",
      '  const nota = esPolar ? (polarEmpty ? " · polo vacío" : " · polo con datos") : "";',
      "  console.log(",
      "    `${record(isImage, empty)} ${g.key.padEnd(20)} ${String(r.status).padStart(3)} ${String(r.bytes).padStart(6)}B  ${time || \"(sin fecha)\"}  ${g.layer}` +",
      "      `\\n      ${\" \".repeat(20)} polo ${String(polar.status).padStart(3)} ${String(polar.bytes).padStart(6)}B${nota}`,",
      "  );",
      "}",
    ].join("\n") + "\n",
);

if (checkOnly) {
  console.log("\n--check: no se escribe nada.");
  process.exit(0);
}

for (const [file, content] of Object.entries(files)) writeFileSync(file, content);
console.log("\nParche aplicado.");
