/**
 * Arreglo de entorno para los tests, no para la aplicación.
 *
 * Node trae desde la 22 su propio `localStorage` global: sin `--localstorage-file`
 * sólo avisa y devuelve `undefined`. Vitest copia los globales de jsdom al
 * `globalThis`, pero se salta las claves que ya existen, así que el `localStorage`
 * de jsdom nunca llegaba: los tests que guardan la mejor marca del arcade o que
 * marcan un vídeo como revivido fallaban con «Cannot read properties of undefined».
 *
 * Si el navegador simulado no tiene almacenamiento, se instala uno en memoria con
 * la misma API que `Storage`. No se hace en producción: la app sigue usando el del
 * navegador, y este fichero sólo lo carga Vitest.
 */

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function installLocalStorage(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage) return;

  const storage = memoryStorage();
  for (const target of [window as unknown as object, globalThis as unknown as object]) {
    try {
      Object.defineProperty(target, "localStorage", {
        value: storage,
        configurable: true,
        writable: true,
      });
    } catch {
      // Sólo el `globalThis` es obligatorio; si la ventana no se deja, se sigue.
    }
  }
  if (!globalThis.localStorage) {
    throw new Error("No se pudo instalar localStorage para los tests");
  }
}

installLocalStorage();
