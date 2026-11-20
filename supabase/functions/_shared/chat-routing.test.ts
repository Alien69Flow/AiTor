import { describe, expect, it } from "vitest";
import {
  answerChain,
  buildPlanBlock,
  buildPrepRequest,
  CHEAP_MODEL,
  KEEP_RECENT_MESSAGES,
  isQuotaDeath,
  MAX_HISTORY_CHARS,
  parsePrepAnswer,
  planPrep,
  prepModel,
  resolveWithFallback,
  tierOf,
  trimHistory,
  type ChatTurn,
} from "./chat-routing";

/**
 * El reparto por coste se juega en dos sitios: qué trabajo se manda al modelo
 * barato y qué se hace cuando la clave del bueno muere. Estas pruebas fijan
 * ambas cosas sin red: el planificador no debe colarse en la respuesta final,
 * una respuesta ilegible del clasificador no puede tumbar el turno, y la cadena
 * de respaldo nunca vuelve a llamar a la clave caída.
 */

const LOVABLE_OK = "AIzaSyB7f3a2b7c1d4e6f8a0b2c3d4e5f6a7b8c";
const XAI_OK = "xai-9f3a2b7c1d4e6f8a0b2c3d4e5f6a7b8c";
const DEEPSEEK_OK = "sk-9f3a2b7c1d4e6f8a0b2c3d4e5f6a7b8c";
const ANTHROPIC_OK = "sk-ant-9f3a2b7c1d4e6f8a0b2c3d4e5f6a7b8c";

function envCon(claves: Record<string, string>) {
  return (name: string): string | undefined => claves[name];
}

const turn = (role: "user" | "assistant", content: string): ChatTurn => ({ role, content });

describe("nivel de precio del modelo", () => {
  it("clasifica como baratos los modelos de trabajo y como buenos el resto", () => {
    expect(tierOf("google/gemini-2.5-flash-lite")).toBe("cheap");
    expect(tierOf("openai/gpt-5-nano")).toBe("cheap");
    expect(tierOf("google/gemini-2.5-pro")).toBe("good");
    expect(tierOf("anthropic/claude-sonnet-4")).toBe("good");
    expect(tierOf(CHEAP_MODEL)).toBe("cheap");
  });
});

describe("planificador barato", () => {
  it("siempre clasifica, pero no comprime un historial corto", () => {
    const plan = planPrep([turn("user", "hola"), turn("assistant", "buenas")]);
    expect(plan.needed).toBe(true);
    expect(plan.compressHistory).toBe(false);
  });

  it("comprime cuando el historial pasa del umbral", () => {
    const largo = Array.from({ length: 8 }, (_, index) =>
      turn(index % 2 === 0 ? "user" : "assistant", "x".repeat(MAX_HISTORY_CHARS / 6)),
    );
    const plan = planPrep(largo);
    expect(plan.historyChars).toBeGreaterThan(MAX_HISTORY_CHARS);
    expect(plan.compressHistory).toBe(true);
  });

  it("cuenta también los datos de herramientas al decidir si comprime", () => {
    const corto = [turn("user", "una pregunta")];
    expect(planPrep(corto).compressHistory).toBe(false);
    // Un historial corto con un volcado enorme: lo que se resume son los datos.
    const conDatos = planPrep(corto, ["y".repeat(MAX_HISTORY_CHARS + 1)]);
    expect(conDatos.compressContext).toBe(true);
    expect(conDatos.compressHistory).toBe(false);
  });

  it("no resume datos pequeños: costaría más de lo que ahorra", () => {
    expect(planPrep([turn("user", "hola")], ["dato corto"]).compressContext).toBe(false);
  });

  it("separa historial antiguo de últimos turnos en el prompt", () => {
    const turns = Array.from({ length: 8 }, (_, index) => turn(index % 2 === 0 ? "user" : "assistant", `t${index}`));
    const plan = planPrep(turns, ["z".repeat(MAX_HISTORY_CHARS + 1)]);
    const request = buildPrepRequest(turns, plan, ["dato de herramienta"]);

    expect(request.user).toContain("HISTORIAL A COMPRIMIR");
    expect(request.user).toContain("t0");
    expect(request.user).toContain("dato de herramienta");
    const ultimo = turns[turns.length - 1].content;
    expect(request.user.indexOf(ultimo)).toBeGreaterThan(request.user.indexOf("ÚLTIMOS TURNOS"));
  });

  it("sin compresión no pide resumen", () => {
    const turns = [turn("user", "hola")];
    expect(buildPrepRequest(turns, planPrep(turns)).user).not.toContain("HISTORIAL A COMPRIMIR");
  });
});

describe("respuesta del clasificador", () => {
  it("lee el JSON aunque venga con bloque de código o prosa", () => {
    const rodeado =
      'Claro, aquí va:\n```json\n{"intencion":"precio de BTC","idioma":"es","formato":"lista"}\n```\nListo.';
    const answer = parsePrepAnswer(rodeado);
    expect(answer).toMatchObject({ intencion: "precio de BTC", idioma: "es", formato: "lista" });
  });

  it("no inventa campos ausentes ni acepta el texto null", () => {
    const answer = parsePrepAnswer('{"intencion":"resumir","idioma":null,"formato":"null"}');
    expect(answer).not.toBeNull();
    expect(answer!.intencion).toBe("resumir");
    expect(answer!.idioma).toBeNull();
    expect(answer!.formato).toBeNull();
  });

  it("devuelve null si no hay objeto legible", () => {
    expect(parsePrepAnswer("no puedo ayudarte con eso")).toBeNull();
    expect(parsePrepAnswer("{ esto no es json }")).toBeNull();
    expect(parsePrepAnswer("{}")).toBeNull();
  });

  it("recorta un resumen desmedido antes de meterlo en el prompt", () => {
    const answer = parsePrepAnswer(JSON.stringify({ resumen: "r".repeat(5_000) }));
    expect(answer!.resumen!.length).toBeLessThanOrEqual(1_200);
  });
});

describe("bloque de plan para el modelo bueno", () => {
  it("lleva idioma, intención, formato y resumen", () => {
    const block = buildPlanBlock({
      intencion: "comparar dos tokens",
      idioma: "es",
      formato: "tabla",
      resumen: "el usuario ya preguntó por BTC",
    });
    expect(block).toContain("Responde en: es");
    expect(block).toContain("comparar dos tokens");
    expect(block).toContain("Formato pedido: tabla");
    expect(block).toContain("el usuario ya preguntó por BTC");
  });

  it("no añade nada si el clasificador no devolvió nada útil", () => {
    expect(buildPlanBlock({ intencion: null, idioma: null, formato: null, resumen: null })).toBe("");
  });
});

describe("historial que se manda al modelo bueno", () => {
  it("se queda con los turnos recientes cuando hubo resumen", () => {
    const turns = Array.from({ length: 10 }, (_, index) => turn("user", `t${index}`));
    const recortado = trimHistory(turns, parsePrepAnswer('{"resumen":"lo de antes"}'), {
      needed: true,
      compressHistory: true,
      compressContext: false,
      historyChars: 99_999,
    });
    expect(recortado).toHaveLength(KEEP_RECENT_MESSAGES);
    expect(recortado[recortado.length - 1].content).toBe("t9");
  });

  it("no recorta nada si el clasificador falló", () => {
    const turns = Array.from({ length: 10 }, (_, index) => turn("user", `t${index}`));
    const plan = { needed: true, compressHistory: true, compressContext: false, historyChars: 99_999 };
    expect(trimHistory(turns, null, plan)).toHaveLength(10);
  });
});

describe("caída por cuota", () => {
  it("reconoce cuota agotada y claves revocadas", () => {
    expect(isQuotaDeath(429, "")).toBe(true);
    expect(isQuotaDeath(402, "Payment required")).toBe(true);
    expect(isQuotaDeath(400, "insufficient credits in workspace")).toBe(true);
    expect(isQuotaDeath(401, "invalid api key")).toBe(true);
  });

  it("no trata como cuota un cuerpo inválido ni un fallo del modelo", () => {
    expect(isQuotaDeath(400, "messages must be an array")).toBe(false);
    expect(isQuotaDeath(502, "upstream error")).toBe(false);
    expect(isQuotaDeath(500, "model overloaded")).toBe(false);
  });
});

describe("cadena de claves de respaldo", () => {
  it("no repite el proveedor del modelo caído y prefiere su mismo nivel", () => {
    const chain = answerChain(
      "google/gemini-2.5-pro",
      envCon({ LOVABLE_API_KEY: LOVABLE_OK, XAI_OK: "", ANTHROPIC_API_KEY: ANTHROPIC_OK, DEEPSEEK_API_KEY: DEEPSEEK_OK }),
    );
    expect(chain).not.toContain("google/gemini-2.5-pro");
    expect(chain).not.toContain("google/gemini-2.5-flash");
    expect(chain[0]).toBe("anthropic/claude-sonnet-4");
    expect(chain).toContain("deepseek/deepseek-reasoner");
  });

  it("sólo ofrece proveedores con clave que parece real", () => {
    const chain = answerChain(
      "google/gemini-2.5-pro",
      envCon({ LOVABLE_API_KEY: LOVABLE_OK, ANTHROPIC_API_KEY: "cambia-esto", DEEPSEEK_API_KEY: DEEPSEEK_OK }),
    );
    // Mismo nivel primero (reasoner es el "bueno" de DeepSeek), luego los baratos.
    expect(chain).toEqual(["deepseek/deepseek-reasoner", "deepseek/deepseek-v3", "deepseek/deepseek-chat"]);
  });

  it("si no hay otra clave, la cadena queda vacía", () => {
    expect(answerChain("google/gemini-2.5-pro", envCon({ LOVABLE_API_KEY: LOVABLE_OK }))).toEqual([]);
  });

  it("no repite modelos", () => {
    const chain = answerChain(
      "anthropic/claude-sonnet-4",
      envCon({ LOVABLE_API_KEY: LOVABLE_OK, XAI_OK: XAI_OK, DEEPSEEK_API_KEY: DEEPSEEK_OK }),
    );
    expect(new Set(chain).size).toBe(chain.length);
  });
});

describe("recorrido de claves hasta que una responda", () => {
  it("se queda con la primera que contesta y no prueba más", async () => {
    const probadas: string[] = [];
    const salida = await resolveWithFallback(["a", "b"], async (model) => {
      probadas.push(model);
      return { ok: model === "a", status: model === "a" ? 200 : 500 };
    });
    expect(salida.model).toBe("a");
    expect(probadas).toEqual(["a"]);
  });

  it("pasa a la siguiente clave cuando la anterior muere por cuota", async () => {
    const salida = await resolveWithFallback(["a", "b"], async (model) =>
      model === "a"
        ? { ok: false, status: 429, errorText: "quota exceeded" }
        : { ok: true, status: 200, value: "respuesta" },
    );
    expect(salida.model).toBe("b");
    expect(salida.attempt.value).toBe("respuesta");
    expect(salida.tried).toEqual(["a", "b"]);
  });

  it("pasa a la siguiente cuando el proveedor ni responde (clave ausente)", async () => {
    const salida = await resolveWithFallback(["a", "b"], async (model) =>
      model === "a" ? { ok: false, status: 0, errorText: "" } : { ok: true, status: 200, value: 1 },
    );
    expect(salida.model).toBe("b");
  });

  it("no gasta otra clave por un cuerpo inválido", async () => {
    const probadas: string[] = [];
    const salida = await resolveWithFallback(["a", "b"], async (model) => {
      probadas.push(model);
      return { ok: false, status: 400, errorText: "messages must be an array" };
    });
    expect(probadas).toEqual(["a"]);
    expect(salida.model).toBe("a");
    expect(salida.attempt.status).toBe(400);
  });

  it("si todas mueren por cuota devuelve el último fallo, no un éxito vacío", async () => {
    const salida = await resolveWithFallback(["a", "b"], async () => ({ ok: false, status: 402, errorText: "credits" }));
    expect(salida.model).toBe("b");
    expect(salida.attempt.ok).toBe(false);
    expect(salida.tried).toEqual(["a", "b"]);
  });
});

describe("modelo barato disponible", () => {
  it("prefiere Flash Lite cuando su clave está puesta", () => {
    expect(prepModel(envCon({ LOVABLE_API_KEY: LOVABLE_OK }))).toBe(CHEAP_MODEL);
  });

  it("baja al siguiente barato de otro proveedor si falta la clave del gateway", () => {
    expect(prepModel(envCon({ XAI_OK: "", GROK_API_KEY: XAI_OK }))).toBe("xai/grok-2");
  });

  it("devuelve null sin ninguna clave útil", () => {
    expect(prepModel(envCon({}))).toBeNull();
  });
});
