import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reloadOnceForStaleChunk } from "./lazy-retry";

/**
 * El guardián de chunks es lo único que impide que una pestaña con el
 * manifiesto viejo se quede con los módulos muertos, así que lo que hay que
 * blindar no es que recargue, sino que **no** recargue dos veces seguidas: un
 * chunk que de verdad no existe convertiría el aviso en un bucle infinito.
 */
describe("reloadOnceForStaleChunk", () => {
  const KEY = "chunk-reload-ts";

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("recarga la primera vez y deja constancia del intento", () => {
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(KEY)).toBe(String(Date.now()));
  });

  it("no vuelve a recargar dentro de la ventana de 30 s", () => {
    const reload = vi.fn();

    reloadOnceForStaleChunk(reload);
    // Cinco avisos más del mismo import roto (y de otros tres módulos).
    for (let i = 0; i < 5; i++) {
      expect(reloadOnceForStaleChunk(reload)).toBe(false);
    }

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("vuelve a permitir una recarga cuando la ventana expira", () => {
    const reload = vi.fn();

    reloadOnceForStaleChunk(reload);
    vi.setSystemTime(new Date("2026-10-29T12:00:29Z"));
    expect(reloadOnceForStaleChunk(reload)).toBe(false);

    vi.setSystemTime(new Date("2026-10-29T12:00:31Z"));
    expect(reloadOnceForStaleChunk(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("con el almacenamiento bloqueado recarga sin lanzar", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
