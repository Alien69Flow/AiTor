/**
 * Which marker silhouette an aircraft deserves, from its ADS-B emitter category.
 *
 * The category is the two-character code the transponder broadcasts: A1–A6 are
 * aeroplanes by weight class, A7 a rotorcraft, B1 a glider, B2 a balloon or
 * airship, B6 an unmanned aircraft. Anything unknown stays an aeroplane, which
 * is the honest default rather than a wrong specific shape.
 *
 * Kept out of the Cesium component so it can be tested without a WebGL context.
 */
export type AircraftSilhouette = "plane" | "helicopter" | "balloon" | "drone";

export function aircraftSilhouette(category: string | null | undefined): AircraftSilhouette {
  const code = (category || "").trim().toUpperCase();
  if (code === "A7") return "helicopter";
  if (code === "B2") return "balloon";
  if (code === "B6") return "drone";
  return "plane";
}
