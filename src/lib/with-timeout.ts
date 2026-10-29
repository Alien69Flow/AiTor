/**
 * Un plazo para las respuestas del backend.
 *
 * `fetch` no tiene timeout propio y `functions.invoke` tampoco: si una Edge
 * Function se queda colgada (arranque en frío contra una fuente externa lenta),
 * la promesa no resuelve nunca y el `finally` que apaga el estado de carga no
 * corre. En el globo eso se ve como una capa que se queda «cargando» para
 * siempre, sin marcadores y sin explicación.
 *
 * Aquí se falla rápido: quien llama decide qué conservar mientras tanto. Las
 * capas del globo conservan la última lectura buena, que es más útil que un
 * hueco vacío.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${what}: sin respuesta en ${Math.round(ms / 1000)} s`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
