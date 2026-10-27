/**
 * Dónde está el Sol sobre la Tierra, calculado sin dependencias.
 *
 * Cesium ya mueve su propia luz y su terminador día/noche, pero este proyecto
 * necesita además *dónde* cae el Sol para situar la llegada del viento solar
 * (la heliosfera) en el globo, y para eso hace falta un punto con latitud y
 * longitud, no una luz. Se usa el algoritmo de baja precisión de Meeus (el
 * mismo que publica NOAA): error por debajo de 0,02°, mil kilómetros de sobra a
 * escala planetaria, y sin traer una librería de efemérides.
 *
 * El terminador de Cesium y este punto pueden diferir en centésimas de grado:
 * son dos cálculos independientes del mismo Sol, y la capa lo dice.
 */

const DEG = Math.PI / 180;

/** Grados normalizados a (-180, 180]. */
export function normalizeLongitude(deg: number): number {
  const wrapped = ((deg + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export interface SubsolarPoint {
  /** Latitud del punto donde el Sol está en el cenit, en grados. */
  lat: number;
  /** Longitud del mismo punto, en grados. */
  lon: number;
  /** Declinación solar, en grados (coincide con `lat`). */
  declination: number;
  /** Ángulo horario de Greenwich al que se ha referido el cálculo, en grados. */
  gmst: number;
}

/**
 * Punto subsolar (lat/lon) para un instante dado.
 *
 * Pasos: longitud media y anomalía media del Sol → longitud eclíptica →
 * declinación y ascensión recta → hora sidérea de Greenwich. El punto subsolar
 * es donde la ascensión recta del Sol iguala el ángulo horario local.
 */
export function subsolarPoint(when: Date = new Date()): SubsolarPoint {
  // Días julianos desde J2000.0 (2000-01-01T12:00Z).
  const jd = when.getTime() / 86_400_000 + 2_440_587.5;
  const n = jd - 2_451_545.0;

  const meanLongitude = 280.46 + 0.9856474 * n;
  const meanAnomaly = (357.528 + 0.9856003 * n) * DEG;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) / DEG;
  const rightAscension =
    Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) / DEG;

  // Hora sidérea media de Greenwich: 360,9856474° por día solar medio.
  const gmst = ((280.46061837 + 360.98564736629 * n) % 360 + 360) % 360;

  return {
    lat: declination,
    lon: normalizeLongitude(rightAscension - gmst),
    declination,
    gmst,
  };
}
