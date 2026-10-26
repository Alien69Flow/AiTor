import { describe, expect, it, vi } from "vitest";

vi.mock("./live-status.generated", () => ({
  LIVE_STATUS_CHECKED_ON: "2026-10-26",
  LIVE_STATUS: {
    "cam-live": { live: true, embeddable: true, checkedAt: "2026-10-26T06:00:00.000Z" },
    "cam-dead": { live: false, embeddable: true, checkedAt: "2026-10-26T06:00:00.000Z" },
    "cam-flaky": { live: null, embeddable: null, checkedAt: "2026-10-26T06:00:00.000Z" },
  },
}));

import { isSignalLive, lastLiveCheck, signalLiveState } from "./live-status";

const signal = (id: string, liveAtBuild: boolean) => ({ id, liveAtBuild });

describe("estado semanal de las cámaras", () => {
  it("la reverificación manda sobre la foto del build", () => {
    expect(signalLiveState(signal("cam-live", false))).toBe("live");
    expect(isSignalLive(signal("cam-live", false))).toBe(true);

    expect(signalLiveState(signal("cam-dead", true))).toBe("offline");
    expect(isSignalLive(signal("cam-dead", true))).toBe(false);
  });

  it("si la sonda no pudo determinar nada, se mantiene el flag original", () => {
    expect(signalLiveState(signal("cam-flaky", true))).toBe("unknown");
    expect(isSignalLive(signal("cam-flaky", true))).toBe(true);
    expect(isSignalLive(signal("cam-flaky", false))).toBe(false);
  });

  it("una cámara que no aparece en el informe también usa el flag original", () => {
    expect(signalLiveState(signal("nueva", true))).toBe("unknown");
    expect(isSignalLive(signal("nueva", false))).toBe(false);
  });

  it("expone la fecha de la última verificación", () => {
    expect(lastLiveCheck()).toBe("2026-10-26");
  });
});
