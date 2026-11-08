#!/usr/bin/env node
/**
 * Monta los cuatro motores nuevos en la pestaña de juegos.
 *
 * Hace tres cosas y ninguna a ciegas: añade las cuatro fichas al registro
 * (`miniapps.ts`), mete sus tarjetas en el arcade (`GamesTab.tsx`) y arregla
 * las dos pruebas del catálogo del globo que quedaron congeladas en el
 * comportamiento anterior a #63/#64 — sin eso, `main` sigue en rojo y ninguna
 * PR puede pasar el check requerido.
 *
 * Todo o nada: si un ancla no aparece una sola vez, sale con 1 sin escribir.
 * Es idempotente: si las tarjetas ya están importadas, no toca nada.
 *
 * Uso:  node scripts/arcade-engines-patch.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

const APPS = "src/lib/miniapps.ts";
const TAB = "src/components/games/GamesTab.tsx";
const LAYERS_TEST = "src/lib/globe-layers.test.ts";

const files = {
  [APPS]: readFileSync(APPS, "utf8"),
  [TAB]: readFileSync(TAB, "utf8"),
  [LAYERS_TEST]: readFileSync(LAYERS_TEST, "utf8"),
};

const checkOnly = process.argv.includes("--check");

if (files[TAB].includes("./ArcadeRacers")) {
  console.log("Los motores ya están montados; no se toca nada.");
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

const ENTRIES = `\t{
\t\tid: "kart",
\t\tname: "Kart de la órbita",
\t\tkind: "arcade",
\t\tstatus: "jugable",
\t\ttagline: "Dos vueltas con deriva: la curva empuja más cuanto más rápido pasas.",
\t\tcontrols: "Flechas izquierda y derecha para corregir, espacio para frenar; botones en móvil.",
\t\tpointsRule: "1000 por vuelta cerrada y hasta 400 por el tramo en curso.",
\t\tchallenge: false,
\t\tcomponent: "KartRaceGame",
\t\tengine: "src/lib/arcade-racers.ts",
\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
\t},
\t{
\t\tid: "chicken-road",
\t\tname: "Cruce de carriles",
\t\tkind: "arcade",
\t\tstatus: "jugable",
\t\ttagline: "Nueve filas de tráfico y una gallina que no puede dudar.",
\t\tcontrols: "Salta hacia delante y muévete de lado; el tráfico no espera.",
\t\tpointsRule: "20 por salto, 60 por fila alcanzada y 500 por cruzar.",
\t\tchallenge: false,
\t\tcomponent: "ChickenCrossGame",
\t\tengine: "src/lib/arcade-racers.ts",
\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
\t},
\t{
\t\tid: "lane-clash",
\t\tname: "Combate por carriles",
\t\tkind: "arcade",
\t\tstatus: "jugable",
\t\ttagline: "Tres carriles, oleadas que avanzan con cada orden y un escudo de un golpe.",
\t\tcontrols: "Muévete de carril, dispara al más cercano y levanta el escudo.",
\t\tpointsRule: "100 por baja y 50 por oleada superada.",
\t\tchallenge: false,
\t\tcomponent: "LaneClashGame",
\t\tengine: "src/lib/arcade-racers.ts",
\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Puntos de liga locales." },
\t},
\t{
\t\tid: "mus",
\t\tname: "Mus",
\t\tkind: "cartas",
\t\tstatus: "jugable",
\t\ttagline: "Baraja española de 40: descartes, pares, juego y punto a 40 piedras.",
\t\tcontrols: "Descarta hasta cuatro cartas, canta y compara los tres lances.",
\t\tpointsRule: "Una piedra por lance ganado: hasta tres por mano, partida a 40.",
\t\tchallenge: false,
\t\tcomponent: "MusGame",
\t\tengine: "src/lib/mus.ts",
\t\tpayouts: { rail: "ninguno", state: "sin premios", note: "Sin apuestas ni saldo: sólo piedras en pantalla." },
\t},
`;

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

// ── Las dos pruebas del catálogo que tienen `main` en rojo ────────────────
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
