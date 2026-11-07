import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReasoningBlock } from "./ReasoningBlock";

/**
 * El panel es la única superficie donde el usuario ve el monólogo del modelo.
 *
 * Se prueba el marcado y no la interacción porque plegar/desplegar vive en un
 * `useEffect` y aquí se renderiza a estático: lo que interesa fijar es que el
 * texto del razonamiento sale del componente y que un mensaje sin razonamiento
 * no deja un hueco vacío en la conversación.
 */
describe("panel de razonamiento", () => {
  it("muestra el razonamiento mientras el modelo piensa", () => {
    const html = renderToStaticMarkup(<ReasoningBlock text="Miro el árbol del repositorio." active />);
    expect(html).toContain("Miro el árbol del repositorio.");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Razonamiento");
  });

  it("no deja un bloque vacío cuando no hay razonamiento", () => {
    expect(renderToStaticMarkup(<ReasoningBlock text="   " active={false} />)).toBe("");
  });
});
