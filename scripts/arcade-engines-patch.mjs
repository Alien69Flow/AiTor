#!/usr/bin/env node
/**
 * Monta los cuatro motores nuevos en la pestaña de juegos.
 *
 * Hace tres cosas y ninguna a ciegas:
 *
 * 1. Arregla dos fallos del motor del kart que sólo se ven jugando: el marcador
 *    pasaba del techo de la partida (el parcial se calculaba con las vueltas ya
 *    acotadas) y el volante empujaba al revés de como se pulsa.
 * 2. Añade las cuatro fichas al registro (`miniapps.ts`) y mete sus tarjetas en
 *    el arcade (`GamesTab.tsx`).
 * 3. Arregla las dos pruebas del catálogo del globo que quedaron congeladas en
 *    el comportamiento anterior a #63/#64 — sin eso, `main` sigue en rojo y
 *    ninguna PR pasa el check requerido.
 *
 * Todo o nada: si un ancla no aparece una sola vez, sale con 1 sin escribir.
 * Es idempotente: lo que ya está aplicado se salta, así que se puede relanzar.
 *
 * Uso:  node scripts/arcade-engines-patch.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

const APPS = "src/lib/miniapps.ts";
const TAB = "src/components/games/GamesTab.tsx";
const LAYERS_TEST = "src/lib/globe-layers.test.ts";
const ENGINE = "src/lib/arcade-racers.ts";

const files = {
  [ENGINE]: readFileSync(ENGINE, "utf8"),
  [APPS]: readFileSync(APPS, "utf8"),
  [TAB]: readFileSync(TAB, "utf8"),
  [LAYERS_TEST]: readFileSync(LAYERS_TEST, "utf8"),
};

const checkOnly = process.argv.includes("--check");

function swap(file, label, pattern, build) {
  const src = files[file];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = (src.match(new RegExp(pattern.source, flags)) ?? []).length;
  if (count !== 1) {
    throw new Error(`${file}: «${label}» aparece ${count} veces, se esperaba 1. No se escribe nada.`);
  }
  files[file] = src.replace(pattern, (...args) => build(args[0], args.slice(1, -2)));
  console.log(`OK    ${file} · ${label}`);
}

function applyOnce(file, label, marker, pattern, build) {
  if (files[file].includes(marker)) {
    console.log(`SKIP  ${file} · ${label} (ya estaba)`);
    return;
  }
  swap(file, label, pattern, build);
}

/* 1. Motor del kart ------------------------------------------------------- */

applyOnce(
  ENGINE,
  "el volante empuja hacia donde se pulsa",
  "pull + input.steer * KART_STEER_GRIP",
  /\(pull\s*-\s*input\.steer\s*\*\s*KART_STEER_GRIP\)/,
  () => "(pull + input.steer * KART_STEER_GRIP)",
);

applyOnce(
  ENGINE,
  "el tramo del marcador no pasa del techo",
  "laps >= KART_LAPS ? 0",
  /export function kartScore\(state: KartState\): number \{[\s\S]*?\n\}/,
  () =>
    [
      "export function kartScore(state: KartState): number {",
      "  const laps = clamp(Math.floor(state.distance / KART_LAP_LENGTH), 0, KART_LAPS);",
      "  // El parcial sólo cuenta mientras la vuelta está en curso: restar contra la",
      "  // distancia con las vueltas ya acotadas dejaba un parcial ficticio en la meta",
      "  // y el marcador pasaba del techo de la partida.",
      "  const partial = laps >= KART_LAPS ? 0 : clamp((state.distance - laps * KART_LAP_LENGTH) / KART_LAP_LENGTH, 0, 1);",
      "  return Math.round(laps * KART_LAP_POINTS + partial * KART_PARTIAL_POINTS);",
      "}",
    ].join("\n"),
);

/* 2. Registro y pestaña --------------------------------------------------- */

const ENTRIES = `\t{\n\t\tid: "kart",\n\t\tname: "Kart de la órbita",\n\t\tkind: "arcade",\n\t\tstatus: "jugable",\n\t\ttagline: "Dos vueltas con deriva: la curva empuja más cuanto más rápido pasas.",\n\t\tcontrols: "Flechas izquierda y derecha para corregir, espacio para frenar; botones en móvil.",\n\t\tpointsRule: "1000 por vuelta cerrada y hasta 400 por el tramo en curso.",\n\t\tchallenge: false,\n\t\tcomponent: "KartRaceGame",\n\t\tengine: "src/lib/arcade-racers.ts",\n\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },\n\t},\n\t{\n\t\tid: "chicken-road",\n\t\tname: "Cruce de carriles",\n\t\tkind: "arcade",\n\t\tstatus: "jugable",\n\t\ttagline: "Nueve filas de tráfico y una gallina que no puede dudar.",\n\t\tcontrols: "Salta hacia delante y muévete de lado; el tráfico no espera.",\n\t\tpointsRule: "20 por salto, 60 por fila alcanzada y 500 por cruzar.",\n\t\tchallenge: false,\n\t\tcomponent: "ChickenCrossGame",\n\t\tengine: "src/lib/arcade-racers.ts",\n\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },\n\t},\n\t{\n\t\tid: "lane-clash",\n\t\tname: "Combate por carriles",\n\t\tkind: "arcade",\n\t\tstatus: "jugable",\n\t\ttagline: "Tres carriles, oleadas que avanzan con cada orden y un escudo de un golpe.",\n\t\tcontrols: "Muévete de carril, dispara al más cercano y levanta el escudo.",\n\t\tpointsRule: "100 por baja y 50 por oleada superada.",\n\t\tchallenge: false,\n\t\tcomponent: "LaneClashGame",\n\t\tengine: "src/lib/arcade-racers.ts",\n\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },\n\t},\n\t{\n\t\tid: "mus",\n\t\tname: "Mus",\n\t\tkind: "cartas",\n\t\tstatus: "jugable",\n\t\ttagline: "Baraja española de 40: descartes, pares, juego y punto a 40 piedras.",\n\t\tcontrols: "Descarta hasta cuatro cartas, canta y compara los tres lances.",\n\t\tpointsRule: "Una piedra por lance ganado: hasta tres por mano, partida a 40.",\n\t\tchallenge: false,\n\t\tcomponent: "MusGame",\n\t\tengine: "src/lib/mus.ts",\n\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Sin apuestas ni saldo: sólo piedras en pantalla." },\n\t},\n`;

if (files[TAB].includes("./ArcadeRacers")) {
  console.log(`SKIP  ${TAB} · las tarjetas ya están montadas`);
} else {
  swap(
    APPS,
    "fichas de los cuatro motores",
    /(\n)\];(\n\n\/\*\* Los que ya se pueden jugar\. \*\/)/,
    (whole, [nl, tail]) => `${nl}${ENTRIES}];${tail}`,
  );

  swap(
    TAB,
    "import de las tarjetas nuevas",
    /import \{ ImpulseGame, MemoryGame, ReactorGame, VeintiunaGame \} from "\.\/GamesArcade";/,
    () =>
      'import { ImpulseGame, MemoryGame, ReactorGame, VeintiunaGame } from "./GamesArcade";\n' +
      'import { ChickenCrossGame, KartRaceGame, LaneClashGame, MusGame } from "./ArcadeRacers";',
  );

  swap(
    TAB,
    "las cuatro tarjetas en el arcade",
    /<VeintiunaGame best=\{profile\.best\.veintiuna\} onRun=\{handleRun\} \/>/,
    () =>
      [
        "<VeintiunaGame best={profile.best.veintiuna} onRun={handleRun} />",
        "\t\t\t\t\t\t<KartRaceGame />",
        "\t\t\t\t\t\t<ChickenCrossGame />",
        "\t\t\t\t\t\t<LaneClashGame />",
        "\t\t\t\t\t\t<MusGame />",
      ].join("\n"),
  );

  swap(
    TAB,
    "cuenta de juegos del encabezado",
    /cuatro juegos que corren enteros/,
    () => "siete juegos que corren enteros",
  );
}

/* 3. Las dos pruebas del catálogo que tienen `main` en rojo ---------------- */

if (!files[LAYERS_TEST].includes("las corrientes piden el último compuesto")) {
  swap(
    LAYERS_TEST,
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
      ].join("\n"),
  );
}

if (files[LAYERS_TEST].includes("no viene encendida")) {
  swap(
    LAYERS_TEST,
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
}

if (checkOnly) {
  console.log("\n--check: no se escribe nada.");
  process.exit(0);
}

for (const [file, content] of Object.entries(files)) writeFileSync(file, content);
console.log("\nMotores montados.");
