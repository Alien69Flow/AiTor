import { describe, expect, it } from "vitest";
import {
  applyGlobeVisualProfile,
  PROFILE_MARKER,
} from "./globe-visual-profile";

/** Recorte fiel del arranque del visor: las tres líneas que el parche usa. */
const SOURCE = [
  "    const viewer = new CesiumViewer(container, {",
  "      contextOptions: { webgl: { alpha: false } },",
  "      baseLayer: false,",
  "    });",
  "    viewer.scene.backgroundColor = Color.BLACK;",
  "    viewer.scene.globe.showGroundAtmosphere = true;",
  "    viewer.scene.globe.enableLighting = false;",
  "    viewerRef.current = viewer;",
  "",
].join("\n");

describe("perfil visual del globo", () => {
  it("enciende MSAA y mete el bloque del perfil tras la atmósfera de suelo", () => {
    const result = applyGlobeVisualProfile(SOURCE);

    expect(result.ok).toBe(true);
    expect(result.applied).toEqual(["MSAA 4x en el contexto", "bloque del perfil"]);
    expect(result.source).toContain("msaaSamples: 4");
    expect(result.source).toContain(PROFILE_MARKER);
    // El bloque hereda la sangría del ancla (4 espacios) y suma la suya.
    expect(result.source).toContain("    // Perfil visual");
    expect(result.source).toContain("      const scene = viewer.scene;");
  });

  it("el bloque cubre las cuatro familias: aire, sol, antialiasing y nitidez", () => {
    const { source } = applyGlobeVisualProfile(SOURCE);

    // Atmósfera con dispersión por fragmento.
    expect(source).toContain("sky.perFragmentAtmosphere = true;");
    expect(source).toContain("sky.atmosphereMieScattering = 4.0;");
    expect(source).toContain("sky.atmosphereLightIntensity = 12.0;");
    // Sol real, no una luz fija.
    expect(source).toContain("dynamicAtmosphereLightingFromSun = true;");
    expect(source).toContain("scene.sun.glowFactor = 1.0;");
    // Antialiasing.
    expect(source).toContain("scene.postProcessStages.fxaa.enabled = true;");
    // Nitidez de teselas.
    expect(source).toContain("scene.globe.tileCacheSize = 2500;");
    expect(source).toContain("scene.globe.preloadAncestors = true;");
  });

  it("aplicarlo dos veces no duplica nada", () => {
    const once = applyGlobeVisualProfile(SOURCE);
    const twice = applyGlobeVisualProfile(once.source);

    expect(twice.ok).toBe(true);
    expect(twice.applied).toEqual([]);
    expect(twice.already).toEqual(["MSAA 4x en el contexto", "bloque del perfil"]);
    expect(twice.source).toBe(once.source);
  });

  it("sin el ancla no escribe nada y lo dice", () => {
    const roto = SOURCE.replace(
      "    viewer.scene.globe.showGroundAtmosphere = true;\n",
      "",
    );
    const result = applyGlobeVisualProfile(roto);

    expect(result.ok).toBe(false);
    expect(result.source).toBe(roto);
    expect(result.applied).toEqual([]);
    expect(result.problems.join(" ")).toContain("showGroundAtmosphere");
  });

  it("si el contexto cambia de forma, tampoco escribe nada", () => {
    const roto = SOURCE.replace(
      "contextOptions: { webgl: { alpha: false } },",
      "contextOptions: { webgl: { alpha: false }, msaaSamples: 2 },",
    );
    const result = applyGlobeVisualProfile(roto);

    expect(result.ok).toBe(false);
    expect(result.source).toBe(roto);
    expect(result.problems.join(" ")).toContain("contextOptions");
  });
});
