import { describe, expect, it } from "vitest";
import {
  MOBILE_UI_FILES,
  MOBILE_UI_SWAPS,
  isMobileUiPatched,
  patchMobileUi,
} from "./mobile-ui-patch";

const CHAT = "src/components/chat/ChatMessage.tsx";

/** Un texto mínimo que contiene cada ancla del fichero una sola vez. */
function fixture(file: string): string {
  return MOBILE_UI_SWAPS.filter((swap) => swap.file === file)
    .map((swap) => `<div className=${swap.find} />`)
    .join("\n");
}

describe("mobile-ui-patch", () => {
  it("declara anclas para el chat y para la barra superior", () => {
    expect(MOBILE_UI_FILES).toContain(CHAT);
    expect(MOBILE_UI_FILES).toContain("src/components/dashboard/TopNavBar.tsx");
  });

  it("aplica cada sustitución exactamente una vez", () => {
    for (const file of MOBILE_UI_FILES) {
      const patched = patchMobileUi(fixture(file), file);
      for (const swap of MOBILE_UI_SWAPS.filter((entry) => entry.file === file)) {
        expect(patched).toContain(swap.replace);
        expect(patched).not.toContain(swap.find);
      }
    }
  });

  it("no toca nada si un ancla desapareció", () => {
    expect(() => patchMobileUi("", CHAT)).toThrow(/aparece 0 veces/);
  });

  it("no toca nada si un ancla se repite", () => {
    const swap = MOBILE_UI_SWAPS.find((entry) => entry.file === CHAT);
    expect(swap).toBeDefined();
    expect(() => patchMobileUi(`${swap?.find}${swap?.find}`, CHAT)).toThrow(/aparece 2 veces/);
  });

  it("reconoce un fichero ya parcheado", () => {
    for (const file of MOBILE_UI_FILES) {
      const already = MOBILE_UI_SWAPS.filter((entry) => entry.file === file)
        .map((entry) => entry.replace)
        .join("\n");
      expect(isMobileUiPatched(already, file)).toBe(true);
      expect(isMobileUiPatched(fixture(file), file)).toBe(false);
    }
  });
});
