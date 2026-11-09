import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONNECTOR_LAYER_KEYS,
  DEFAULT_ACTIVE_LAYERS,
  EARTH_SHELLS,
  GLOBE_LAYERS,
  LAYER_GROUPS,
  TIER_RANK,
  isRasterLayer,
  layerDef,
  rasterSiblings,
  type EnvLayerKey,
  type Tier,
} from "./globe-layers";

/**
 * El catálogo es la única descripción de las capas: el panel, el filtro por
 * plan y el propio globo leen de aquí. Un duplicado, un grupo que no existe o
 * una capa GIBS sin nivel rompen el globo en tiempo de ejecución, no al
 * compilar, así que se comprueban aquí.
 */
describe("catálogo de capas del globo", () => {
  it("no repite claves", () => {
    const keys = GLOBE_LAYERS.map((layer) => layer.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cada capa pertenece a un grupo declarado", () => {
    const declared = new Set<string>(LAYER_GROUPS);
    const orphan = GLOBE_LAYERS.filter((layer) => !declared.has(layer.group));
    expect(orphan.map((layer) => `${layer.key}:${layer.group}`)).toEqual([]);
  });

  it("ningún grupo declarado se queda sin capas", () => {
    const empty = LAYER_GROUPS.filter(
      (group) => !GLOBE_LAYERS.some((layer) => layer.group === group),
    );
    expect(empty).toEqual([]);
  });

  it("cada capa GIBS trae el nivel del TileMatrixSet, sin el que responde 404", () => {
    const gibs = GLOBE_LAYERS.filter((layer) => layer.gibs);
    expect(gibs.length).toBeGreaterThan(10);
    for (const layer of gibs) {
      const cfg = layer.gibs!;
      expect(cfg.layer.length, layer.key).toBeGreaterThan(0);
      expect(Number.isInteger(cfg.level), layer.key).toBe(true);
      expect(cfg.level, layer.key).toBeGreaterThanOrEqual(0);
      expect(cfg.level, layer.key).toBeLessThanOrEqual(9);
      // Una capa con fecha fija y además `timeless` dejaría la fecha sin efecto.
      if (cfg.timeless) expect(cfg.date, layer.key).toBeUndefined();
    }
  });

  /**
   * La clorofila es un compuesto: con un `TIME` diario el servidor responde 404
   * casi todos los días (comprobado contra GIBS), así que la capa se quedaría
   * en blanco con un 404 por tesela. Sin fecha sirve el último compuesto.
   */
  it("las capas de compuesto periódico piden el último producto, sin fecha", () => {
    const compuestos: EnvLayerKey[] = ["oceanChlorophyll", "vegetation", "carbonDioxide", "seaSalinity"];
    for (const key of compuestos) {
      const cfg = layerDef(key)!.gibs!;
      expect(cfg.timeless, key).toBe(true);
      expect(cfg.dateOffsetHours, key).toBeUndefined();
    }
  });

  it("las capas por conector existen en el catálogo y no traen raster propio", () => {
    for (const key of CONNECTOR_LAYER_KEYS) {
      const def = layerDef(key);
      expect(def, key).toBeDefined();
      expect(def!.gibs, key).toBeUndefined();
      expect(def!.owm, key).toBeUndefined();
    }
  });

  it("las capas activas por defecto existen todas", () => {
    for (const key of DEFAULT_ACTIVE_LAYERS) {
      expect(layerDef(key), key).toBeDefined();
    }
  });

  /**
   * Ninguna capa puede pedir más que una cuenta. Todas sus fuentes son abiertas
   * o las paga ya el proyecto (OpenWeather por su propia función, VesselFinder,
   * GDELT, CelesTrak, el registro estático de infraestructura), así que
   * esconderlas tras Synapse no protegía ningún coste: dejaba el panel con
   * etiquetas de plan y capas que no se podían encender.
   */
  it("ninguna capa exige un plan de pago para encenderse", () => {
    const dePago = GLOBE_LAYERS.filter((layer) => TIER_RANK[layer.requiredTier] > TIER_RANK.node).map(
      (layer) => `${layer.key}:${layer.requiredTier}`,
    );
    expect(dePago).toEqual([]);
  });

  it("están las capas nuevas del globo, con su fuente declarada", () => {
    const expected: EnvLayerKey[] = [
      "iss",
      "ionosphere",
      "magnetosphere",
      "cloudTopHeight",
      "stratosphere",
      "iceSurfaceTemp",
      "seaSalinity",
      "vegetation",
      "oceanChlorophyll",
      "soilMoisture",
      "carbonDioxide",
      "seaIce",
      "precipitationRate",
      "waterVapor",
      "ozone",
      "landSurfaceTemp",
      "liveCameras",
      "vanAllen",
      "heliosphere",
    ];
    for (const key of expected) {
      const def = layerDef(key);
      expect(def, key).toBeDefined();
      expect(def!.source, key).toBeTruthy();
      expect(def!.description, key).toBeTruthy();
    }
  });
});

/**
 * De la troposfera a la heliosfera: cinco envolturas por altitud y las cuatro
 * esferas del sistema. Sirve para saber de un vistazo qué está cubierto y qué
 * no —la mesosfera se queda sin capa porque ninguna fuente abierta publica una
 * malla suya, y eso es un dato, no un olvido—.
 */
describe("envolturas y esferas de la Tierra", () => {
  it("declara las nueve capas del sistema, de dentro afuera", () => {
    expect(EARTH_SHELLS.map((shell) => shell.id)).toEqual([
      "troposphere",
      "stratosphere",
      "mesosphere",
      "thermosphere",
      "exosphere",
      "biosphere",
      "magnetosphere",
      "vanAllen",
      "heliosphere",
    ]);
    for (const shell of EARTH_SHELLS) {
      expect(shell.label, shell.id).toBeTruthy();
      expect(shell.range, shell.id).toBeTruthy();
    }
  });

  it("las cinco primeras son envolturas y las cuatro últimas, esferas", () => {
    expect(EARTH_SHELLS.filter((shell) => shell.kind === "shell")).toHaveLength(5);
    expect(EARTH_SHELLS.filter((shell) => shell.kind === "sphere").map((s) => s.id)).toEqual([
      "biosphere",
      "magnetosphere",
      "vanAllen",
      "heliosphere",
    ]);
  });

  it("toda capa declarada apunta a una capa que existe y dice quién la mide", () => {
    for (const shell of EARTH_SHELLS) {
      if (!shell.layer) continue;
      expect(layerDef(shell.layer), `${shell.id} → ${shell.layer}`).toBeDefined();
      expect(shell.source, shell.id).toBeTruthy();
    }
  });

  it("sólo la mesosfera se queda sin capa, y no por descuido", () => {
    const huecos = EARTH_SHELLS.filter((shell) => !shell.layer).map((shell) => shell.id);
    expect(huecos).toEqual(["mesosphere"]);
    expect(EARTH_SHELLS.find((shell) => shell.id === "mesosphere")?.note).toContain("Sin capa");
  });

  it("ocho de las nueve capas están cubiertas por medidas reales", () => {
    expect(EARTH_SHELLS.filter((shell) => shell.layer).length).toBe(8);
  });

  it("cuando una capa no cubre toda la esfera, lo dice", () => {
    // El caso que más se puede malinterpretar: el satélite GOES mide desde
    // dentro del cinturón exterior y el interior se dibuja sin intensidad.
    expect(EARTH_SHELLS.find((shell) => shell.id === "vanAllen")?.note).toContain("sin intensidad propia");
    expect(EARTH_SHELLS.find((shell) => shell.id === "heliosphere")?.note).toContain("Voyager");
  });

  /**
   * La secuencia se lee de un tirón: si tres de las nueve pidieran un plan de
   * pago, media lista aparecería en gris para quien sólo tiene cuenta y el
   * conjunto parecería incompleto. Todas sus fuentes son abiertas —TEC de
   * SWPC, OVATION y GOES—, así que basta con iniciar sesión.
   */
  it("ninguna esfera exige más que tener cuenta para encenderse", () => {
    const caras = EARTH_SHELLS.filter((shell) => shell.layer).map((shell) => {
      const def = layerDef(shell.layer!);
      return { id: shell.id, tier: def?.requiredTier };
    });
    const dePago = caras.filter((shell) => TIER_RANK[shell.tier as Tier] > TIER_RANK.node);
    expect(dePago).toEqual([]);
  });
});

/**
 * El fallo que más veces ha llegado al usuario no es una capa mal configurada
 * sino una capa huérfana: aparece en el catálogo y en la leyenda, se puede
 * encender, y no la dibuja nadie. Pasó con «Live Market Data», y los sismos y
 * los satélites tenían el problema inverso: se pintaban siempre, así que su
 * interruptor no hacía nada.
 *
 * Aquí se exige que cada capa tenga un camino de dibujo real, y que las tres
 * capas con entidad propia respeten su interruptor.
 */
describe("cada capa del catálogo tiene quien la pinte", () => {
  const globeSource = readFileSync(resolve(process.cwd(), "src/components/globe/CesiumGlobe.tsx"), "utf8");

  it("ninguna capa queda huérfana", () => {
    const huerfanas = GLOBE_LAYERS.filter((layer) => {
      // Los rásters los itera el efecto de imagery por `owm`/`gibs`.
      if (layer.owm || layer.gibs) return false;
      // Todo lo demás debe consultar su clave en el globo, con la forma de
      // guarda que use (activa, envLayers o marcas).
      return !globeSource.includes(`.has("${layer.key}")`);
    }).map((layer) => layer.key);

    expect(huerfanas).toEqual([]);
  });

  it("los sismos y los satélites obedecen a su capa, no a la suerte del refresco", () => {
    expect(globeSource).toContain('if (envLayers && !envLayers.has("earthquakes")) return;');
    expect(globeSource).toContain('if (envLayers && !envLayers.has("satellites")) return;');
  });

  it("«Live Market Data» enciende los focos de mercado desde el catálogo", () => {
    expect(globeSource).toContain('envLayers.has("marketData")');
  });

  it("«Solar Activity» no arrastra un ráster que no es del Sol", () => {
    // La capa de actividad solar pinta corona y Kp; cualquier ráster suyo
    // duplicaría otra capa y taparía el globo.
    expect(layerDef("solarActivity")?.gibs).toBeUndefined();
    expect(layerDef("nightLights")?.gibs?.layer).toBe("VIIRS_Black_Marble");
  });
});

/**
 * Las capas que ya existían en la leyenda pero no pintaban: clorofila pedía una
 * fecha que el producto aún no publica (GIBS 404), y nieve, temperatura del aire
 * y corrientes no estaban declaradas. Estas pruebas fijan el arreglo y las tres
 * altas para que no vuelvan a desaparecer en silencio.
 */
describe("capas que faltaban o no pintaban", () => {
  it("la clorofila pide la última pasada en vez de una fecha futura", () => {
    const chloro = layerDef("oceanChlorophyll")?.gibs;
    expect(chloro?.layer).toBe("VIIRS_SNPP_L2_Chlorophyll_A");
    expect(chloro?.timeless).toBe(true);
    expect(chloro?.dateOffsetHours).toBeUndefined();
  });

  it("declara nieve, temperatura del aire y corrientes como rásters propios", () => {
    expect(layerDef("snowCover")?.gibs?.layer).toBe("MODIS_Terra_NDSI_Snow_Cover");
    // Sin fecha, GIBS sirve un mosaico vacío para el NDSI: la capa encendida
    // parecía rota. Con 48 h de retraso se pide la pasada que sí tiene datos.
    expect(layerDef("snowCover")?.gibs?.dateOffsetHours).toBe(48);
    expect(layerDef("snowCover")?.gibs?.timeless).toBeUndefined();
    expect(layerDef("airTemperature")?.gibs?.layer).toBe("AIRS_L2_Surface_Air_Temperature_Day");
    expect(layerDef("oceanCurrents")?.gibs?.layer).toBe("OSCAR_Sea_Surface_Currents_Zonal");
  });

  it("el hielo marino es AMSR2 a 25 km y va sin fecha fija", () => {
    const ice = layerDef("seaIce")?.gibs;
    // AMSRU2_Sea_Ice_Concentration_25km es la rejilla polar de AMSR2 (GCOM-W1).
    // GIBS ya no la actualiza a diario: sin segmento TIME sirve la última pasada,
    // que es justo la que se quiere ver en el globo.
    expect(ice?.layer).toBe("AMSRU2_Sea_Ice_Concentration_25km");
    expect(ice?.timeless).toBe(true);
    expect(ice?.date).toBeUndefined();
    expect(ice?.dateOffsetHours).toBeUndefined();
  });
  it("las corrientes piden el último compuesto, sin fecha fija", () => {
    const currents = layerDef("oceanCurrents")?.gibs;
    // OSCAR publica compuestos de 5 días: con un TIME diario GIBS responde 404,
    // así que la capa va sin segmento temporal y sigue a la última pasada.
    expect(currents?.timeless).toBe(true);
    expect(currents?.date).toBeUndefined();
  });
});

/**
 * Dos campos del mismo tipo encendidos a la vez no se suman: se tapan. El
 * globo abría con temperatura, humedad y precipitación puestas y el planeta era
 * una mancha translúcida, así que la exclusividad se defiende aquí y no en un
 * comentario.
 */
describe("un campo por familia", () => {
  it("todo ráster declara familia", () => {
    const sinFamilia = GLOBE_LAYERS.filter((layer) => isRasterLayer(layer) && !layer.rasterFamily);
    expect(sinFamilia.map((layer) => layer.key)).toEqual([]);
  });

  it("las capas de serie no se pisan entre sí", () => {
    const families = DEFAULT_ACTIVE_LAYERS.map((key) => layerDef(key)?.rasterFamily).filter(Boolean);
    expect(new Set(families).size).toBe(families.length);
  });

  it("apagar a las hermanas no apaga a la capa pedida", () => {
    const siblings = rasterSiblings("humidity");
    expect(siblings).not.toContain("humidity");
    expect(siblings).toContain("temperature");
    expect(siblings).toContain("wind");
    // Las nubes son contexto y sobreviven al cambio de campo.
    expect(siblings).not.toContain("clouds");
  });

  it("una capa sin familia no arrastra a nadie", () => {
    expect(rasterSiblings("earthquakes")).toEqual([]);
    expect(rasterSiblings("precipitation")).toEqual([]);
  });

  it("la precipitación de serie es el radar, no el modelo de OpenWeatherMap", () => {
    expect(layerDef("precipitation")?.owm).toBeUndefined();
    expect(layerDef("precipitation")?.source).toContain("RainViewer");
  });
});

describe("envolturas atmosféricas", () => {
  /**
   * Los cascarones son opcionales desde que el globo usa la atmósfera real de
   * Cesium: dos representaciones del mismo aire encendidas a la vez se suman
   * en el limbo del planeta y lo dejan turbio. De serie manda la de Cesium.
   */
  it("la capa existe y viene encendida junto a la atmósfera de Cesium", () => {
    expect(layerDef("atmosphericShells")?.group).toBe("Atmospheric & Weather");
    // #64 la encendió de serie: con sólo el halo, la escalera atmosférica no se
    // podía ver desde fuera y el catálogo la anunciaba sin dibujarla.
    expect(DEFAULT_ACTIVE_LAYERS).toContain("atmosphericShells");
  });
});

/**
 * Tráfico y conflictos encendidos de serie.
 *
 * El globo abría con aviones pero sin barcos ni zonas de conflicto: las dos
 * capas estaban en el catálogo, apagadas y además con etiqueta de plan, así que
 * había que adivinar que existían. Sus fuentes (AIS abierto y GDELT/UCDP) no
 * cuestan nada por petición, así que no hay motivo para esconderlas.
 */
describe("capas de serie para tráfico y conflictos", () => {
  const deSerie: EnvLayerKey[] = ["airTraffic", "marineTraffic", "conflictZones"];

  it("las tres vienen encendidas", () => {
    for (const key of deSerie) {
      expect(DEFAULT_ACTIVE_LAYERS, key).toContain(key);
    }
  });

  it("ninguna exige cuenta para dibujarse", () => {
    for (const key of deSerie) {
      const def = layerDef(key);
      expect(def, key).toBeDefined();
      expect(TIER_RANK[def!.requiredTier], key).toBeLessThanOrEqual(TIER_RANK.signal);
    }
  });

  it("barcos y conflictos no son ráster: no compiten por el techo de teselas", () => {
    for (const key of ["marineTraffic", "conflictZones"] as EnvLayerKey[]) {
      expect(isRasterLayer(layerDef(key)!), key).toBe(false);
    }
  });
});
