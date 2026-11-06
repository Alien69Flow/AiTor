import { describe, expect, it } from "vitest";
import {
  LIVE_CATEGORIES,
  LIVE_SIGNALS,
  signalChannelEmbedUrl,
  signalEmbedUrl,
  signalThumb,
  signalsByCategory,
} from "./live-signals";

/**
 * The camera list is data, and a typo in a video id shows up as a broken box for
 * every user. These checks are cheap and catch the shapes that break the player;
 * the live/offline state cannot be asserted here because it changes hourly.
 */
describe("catálogo de señales en directo", () => {
  it("no repite identificadores de señal", () => {
    const ids = LIVE_SIGNALS.map((signal) => signal.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("usa ids de YouTube con la longitud correcta", () => {
    for (const signal of LIVE_SIGNALS) {
      expect(signal.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });

  it("tiene al menos una cámara por categoría y ninguna categoría vacía", () => {
    for (const category of LIVE_CATEGORIES) {
      expect(signalsByCategory(category.id).length, category.id).toBeGreaterThan(0);
    }
    const used = new Set(LIVE_SIGNALS.map((signal) => signal.category));
    for (const id of used) {
      expect(LIVE_CATEGORIES.map((category) => category.id)).toContain(id);
    }
  });

  it("construye el embed y el póster a partir del id de cada cámara", () => {
    for (const signal of LIVE_SIGNALS) {
      expect(signalEmbedUrl(signal)).toContain(`/embed/${signal.videoId}`);
      expect(signalThumb(signal)).toBe(`https://i.ytimg.com/vi/${signal.videoId}/hqdefault.jpg`);
      const channelEmbed = signalChannelEmbedUrl(signal);
      if (signal.channelId) expect(channelEmbed).toContain(signal.channelId);
      else expect(channelEmbed).toBeNull();
    }
  });

  it("todas las cámaras llevan página de respaldo y ubicación", () => {
    for (const signal of LIVE_SIGNALS) {
      expect(signal.pageUrl, signal.id).toMatch(/^https:\/\//);
      expect(signal.location.trim(), signal.id).not.toBe("");
      expect(signal.label.trim(), signal.id).not.toBe("");
    }
  });
});
