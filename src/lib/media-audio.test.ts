import { describe, expect, it } from "vitest";
import { TOOLS, parseMusicAudio, parseTtsAudio, pcmToWav } from "../../api/mcp";

/**
 * El audio no se puede probar de punta a punta sin clave de Gemini, así que se
 * prueba lo que sí decide si suena o no: la cabecera WAV y el parseo de cada
 * respuesta. Con estas piezas, un fallo en producción se puede leer en el
 * mensaje de error en vez de adivinarlo por un reproductor vacío.
 */

/** PCM de silencio: 100 muestras de 16 bits, 24 kHz, mono. */
const silence = (samples = 100) => new Uint8Array(samples * 2);

describe("catálogo de herramientas", () => {
  it("ofrece las tres capacidades creativas", () => {
    const names = TOOLS.map((tool) => tool.name);
    expect(names).toContain("media.image");
    expect(names).toContain("media.music");
    expect(names).toContain("media.speech");
  });

  it("no promete vídeo", () => {
    expect(TOOLS.map((tool) => tool.name).filter((name) => name.includes("video"))).toEqual([]);
  });
});

describe("pcmToWav", () => {
  it("escribe una cabecera RIFF válida", () => {
    const wav = pcmToWav(silence(100), 24_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const text = (offset: number, length: number) =>
      String.fromCharCode(...wav.slice(offset, offset + length));

    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(4, true)).toBe(36 + 200);
    expect(view.getUint16(20, true)).toBe(1); // PCM lineal
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(200);
    expect(wav.byteLength).toBe(44 + 200);
  });

  it("respeta la frecuencia que manda el modelo", () => {
    const wav = pcmToWav(silence(10), 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000); // bytes por segundo
  });
});

describe("parseTtsAudio", () => {
  const audioPayload = (mimeType: string, data = "AAAA") => ({
    candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }],
  });

  it("envuelve el PCM crudo en WAV y lee la frecuencia del mimeType", () => {
    const parsed = parseTtsAudio(audioPayload("audio/L16;codec=pcm;rate=24000"));
    expect(parsed?.mimeType).toBe("audio/wav");
    const wav = Buffer.from(parsed?.data ?? "", "base64");
    expect(wav.slice(0, 4).toString()).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(24_000);
  });

  it("no toca un audio que ya viene comprimido", () => {
    const parsed = parseTtsAudio(audioPayload("audio/mpeg", "SUQz"));
    expect(parsed).toEqual({ data: "SUQz", mimeType: "audio/mpeg" });
  });

  it("devuelve null cuando no hay audio", () => {
    expect(parseTtsAudio({ candidates: [{ content: { parts: [{ inlineData: {} }] } }] })).toBeNull();
    expect(parseTtsAudio({})).toBeNull();
  });
});

describe("parseMusicAudio", () => {
  it("saca la pista y la letra de los pasos model_output", () => {
    const parsed = parseMusicAudio({
      steps: [
        { type: "model_output", content: [{ type: "text", text: "Verse 1" }] },
        { type: "model_output", content: [{ type: "audio", data: "SUQz", mimeType: "audio/mpeg" }] },
        { type: "user_input", content: [{ type: "audio", data: "IGNORAME" }] },
      ],
    });
    expect(parsed).toEqual({ data: "SUQz", mimeType: "audio/mpeg", lyrics: "Verse 1" });
  });

  it("usa audio/mpeg cuando el bloque no declara tipo", () => {
    const parsed = parseMusicAudio({
      steps: [{ type: "model_output", content: [{ type: "audio", data: "AAA" }] }],
    });
    expect(parsed?.mimeType).toBe("audio/mpeg");
    expect(parsed?.lyrics).toBe("");
  });

  it("devuelve null si el modelo sólo devolvió texto", () => {
    expect(
      parseMusicAudio({ steps: [{ type: "model_output", content: [{ type: "text", text: "no" }] }] }),
    ).toBeNull();
  });
});
