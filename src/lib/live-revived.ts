/**
 * Cámaras que la reverificación dio por apagadas pero que, al abrirlas, estaban
 * emitiendo.
 *
 * El informe semanal es una foto: una cámara puede volver antes del lunes
 * siguiente. Cuando el reproductor confirma que el directo arranca, el id se
 * guarda aquí y la app deja de mostrarla como «sin emisión» en este navegador.
 * Caduca a los 14 días para que no tape un apagón posterior indefinidamente.
 */

export const LIVE_REVIVED_STORAGE_KEY = "aitor_live_revived";
export const REVIVED_TTL_DAYS = 14;

export type RevivedMap = Record<string, string>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Descarta entradas viejas, malformadas o con fecha futura. */
export function pruneRevived(map: unknown, now = Date.now()): RevivedMap {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  const out: RevivedMap = {};
  for (const [id, value] of Object.entries(map as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const at = Date.parse(value);
    if (Number.isNaN(at)) continue;
    const age = now - at;
    if (age < 0 || age > REVIVED_TTL_DAYS * DAY_MS) continue;
    out[id] = value;
  }
  return out;
}

export function readRevived(storage: Pick<Storage, "getItem"> | null = safeStorage()): RevivedMap {
  if (!storage) return {};
  try {
    return pruneRevived(JSON.parse(storage.getItem(LIVE_REVIVED_STORAGE_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function writeRevived(map: RevivedMap, storage: Pick<Storage, "setItem"> | null = safeStorage()) {
  if (!storage) return;
  try {
    storage.setItem(LIVE_REVIVED_STORAGE_KEY, JSON.stringify(pruneRevived(map)));
  } catch {
    // Modo privado o cuota llena: el desmarque dura lo que dure la sesión.
  }
}

export function markRevived(map: RevivedMap, id: string, now = Date.now()): RevivedMap {
  return { ...map, [id]: new Date(now).toISOString() };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
