import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * El reproductor es quien decide si una cámara marcada «sin emisión» vuelve a
 * emitir: montar el iframe no basta (un directo programado también dispara
 * `onReady`), así que el desmarque sólo ocurre cuando el estado es PLAYING.
 */
const { loadMock, playerRef, stateRef } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  playerRef: { current: null as unknown },
  stateRef: { value: 5 },
}));

vi.mock("@/lib/youtube-iframe", () => ({
  loadYouTubeIframeApi: loadMock,
  describePlayerError: (code: number) => `error ${code}`,
}));

import { LiveStage } from "./LiveStage";
import { LIVE_SIGNALS } from "@/lib/live-signals";

const signal = LIVE_SIGNALS[0];

class FakePlayer {
  options: {
    events?: {
      onReady?: (event: { target: unknown }) => void;
      onError?: (event: { data: number }) => void;
      onStateChange?: (event: { data: number }) => void;
    };
  };

  constructor(_element: HTMLElement, options: FakePlayer["options"]) {
    this.options = options;
    playerRef.current = this;
    options.events?.onReady?.({ target: this });
  }

  destroy() {}
  playVideo() {}
  mute() {}
  unMute() {}
  getPlayerState() {
    return stateRef.value;
  }

  emitState(data: number) {
    this.options.events?.onStateChange?.({ data });
  }
}

const player = () => playerRef.current as FakePlayer;

describe("LiveStage · desmarque de «sin emisión»", () => {
  beforeEach(() => {
    stateRef.value = 5; // CUED: el directo aún no ha arrancado
    playerRef.current = null;
    loadMock.mockReset();
    loadMock.mockResolvedValue({ Player: FakePlayer, PlayerState: {} });
  });

  it("no desmarca la cámara sólo porque el reproductor se monte", async () => {
    const onLive = vi.fn();
    render(<LiveStage signal={signal} onUnavailable={vi.fn()} onLive={onLive} />);

    await vi.waitFor(() => expect(playerRef.current).not.toBeNull());
    expect(onLive).not.toHaveBeenCalled();

    // Tampoco cuando el vídeo queda en pausa o bufferizando.
    act(() => player().emitState(3));
    act(() => player().emitState(2));
    expect(onLive).not.toHaveBeenCalled();
  });

  it("desmarca la cámara en cuanto el estado pasa a PLAYING, una sola vez", async () => {
    const onLive = vi.fn();
    render(<LiveStage signal={signal} onUnavailable={vi.fn()} onLive={onLive} />);

    await vi.waitFor(() => expect(playerRef.current).not.toBeNull());
    act(() => player().emitState(1));
    act(() => player().emitState(1));

    expect(onLive).toHaveBeenCalledTimes(1);
    expect(onLive).toHaveBeenCalledWith(signal);
  });

  it("«Reintentar» vuelve a montar el reproductor aunque hubiera un fallo guardado", async () => {
    const onLive = vi.fn();
    const onUnavailable = vi.fn();
    render(
      <LiveStage
        signal={signal}
        blockedReason="El canal no está disponible en este momento."
        onUnavailable={onUnavailable}
        onLive={onLive}
      />,
    );

    expect(screen.getByText(/emisión no disponible/i)).toBeTruthy();
    expect(loadMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await vi.waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));
    act(() => player().emitState(1));
    expect(onLive).toHaveBeenCalledWith(signal);
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});
