import { describe, expect, it } from "vitest";
import { createAiTorMcpServer } from "../index";

/**
 * `weather.outlook` es la herramienta que contesta «¿puedo tender la ropa?».
 * Lo que se comprueba aquí no es la aritmética —vive en environment-metrics,
 * con sus propias pruebas— sino la fontanería: geocodificar cuando sólo hay
 * nombre, no inventar oleaje ni polen donde la fuente no cubre, y devolver el
 * fallo como contenido en vez de tumbar el protocolo.
 */

interface Call {
  url: string;
}

function fakeFetch(responses: Record<string, unknown>, calls: Call[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ url });
    for (const [fragment, body] of Object.entries(responses)) {
      if (url.includes(fragment)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ error: "sin ruta" }), { status: 500 });
  }) as typeof fetch;
}

const forecastBody = {
  current: {
    time: "2026-10-30T12:45",
    temperature_2m: 21.4,
    relative_humidity_2m: 38,
    wind_speed_10m: 18,
    precipitation: 0,
    snow_depth: 0,
    freezing_level_height: 3600,
  },
  hourly: {
    time: ["2026-10-30T13:00", "2026-10-30T14:00"],
    precipitation_probability: [0, 12],
    precipitation: [0, 0],
  },
};

const server = createAiTorMcpServer();

async function call(args: Record<string, unknown>, fetchImpl: typeof fetch) {
  return server.callTool("weather.outlook", args, { tier: "free", fetch: fetchImpl });
}

describe("weather.outlook", () => {
  it("está en el plan gratuito y no exige argumentos", () => {
    expect(server.listTools("free").map((tool) => tool.name)).toContain("weather.outlook");
  });

  it("resuelve el nombre del lugar y devuelve secado, nieve y próximas horas", async () => {
    const calls: Call[] = [];
    const result = await call(
      { place: "Zaragoza" },
      fakeFetch(
        {
          "geocoding-api.open-meteo.com": {
            results: [{ name: "Zaragoza", latitude: 41.65, longitude: -0.88, country_code: "ES" }],
          },
          "api.open-meteo.com/v1/forecast": forecastBody,
        },
        calls,
      ),
    );

    expect(result.isError).toBeUndefined();
    const payload = result.structuredContent as {
      place: { lat: number; lon: number; name: string };
      drying: { index: number; verdict: string };
      snow: { snowDepthCm: number };
      nextHours: { precipitationProbability: number | null }[];
    };
    expect(payload.place).toMatchObject({ lat: 41.65, lon: -0.88 });
    expect(payload.place.name).toContain("Zaragoza");
    // 38 % HR + 18 km/h + 21,4 °C → 56: se seca, pero despacio.
    expect(payload.drying.index).toBe(56);
    expect(payload.drying.verdict).toContain("despacio");
    expect(payload.snow.snowDepthCm).toBe(0);
    expect(payload.nextHours).toHaveLength(2);
    expect(calls.some((call) => call.url.includes("/v1/search"))).toBe(true);
  });

  it("no inventa oleaje ni polen cuando la fuente no cubre el punto", async () => {
    const result = await call(
      { lat: 41.65, lon: -0.88 },
      fakeFetch({ "api.open-meteo.com/v1/forecast": forecastBody }),
    );

    const payload = result.structuredContent as {
      sea: { available: boolean; note?: string };
      pollen: { available: boolean; note?: string };
    };
    expect(payload.sea.available).toBe(false);
    expect(payload.sea.note).toContain("tierra adentro");
    expect(payload.pollen.available).toBe(false);
    expect(payload.pollen.note).toContain("Europa");
  });

  it("en costa devuelve oleaje con bandera y el polen dominante", async () => {
    const result = await call(
      { lat: 43.37, lon: -8.4 },
      fakeFetch({
        "api.open-meteo.com/v1/forecast": forecastBody,
        "marine-api.open-meteo.com": {
          current: { wave_height: 2.4, swell_wave_height: 2.1, sea_surface_temperature: 16.4 },
        },
        "air-quality-api.open-meteo.com": {
          current: {
            grass_pollen: 4,
            olive_pollen: 62,
            birch_pollen: null,
            alder_pollen: null,
            ragweed_pollen: null,
          },
        },
      }),
    );

    const payload = result.structuredContent as {
      sea: { available: boolean; flag: string; waveHeightM: number };
      pollen: { available: boolean; species: string; level: number };
    };
    expect(payload.sea).toMatchObject({ available: true, flag: "roja", waveHeightM: 2.4 });
    expect(payload.pollen).toMatchObject({ available: true, species: "olivo", level: 3 });
  });

  it("sin lugar ni coordenadas lo dice en vez de consultar cualquier cosa", async () => {
    const result = await call({}, fakeFetch({}));
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("place");
  });

  it("un lugar inexistente no se convierte en una previsión de otro sitio", async () => {
    const result = await call(
      { place: "Atlantis" },
      fakeFetch({ "geocoding-api.open-meteo.com": { results: [] } }),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Atlantis");
  });
});
