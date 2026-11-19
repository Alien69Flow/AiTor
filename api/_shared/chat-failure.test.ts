/**
 * Reglas de `api/_shared/chat-failure.ts`, probadas directamente.
 *
 * Hasta ahora solo se ejercitaban de refilón: `/api/health` usaba
 * `chatFailureDetail` y el webhook usaba `chatFailureMessage`, así que una
 * clasificación equivocada podía pasar con las dos suites en verde mientras el
 * bot contaba otra cosa. Aquí se fija cada rama y, sobre todo, que ninguna
 * lectura pueda devolver una credencial.
 */
import { describe, expect, it } from "vitest";
import {
  chatFailureDetail,
  chatFailureMessage,
  classifyChatFailure,
  scrubError,
  type ChatFailure,
  type ChatFailureKind,
} from "./chat-failure";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.firma-de-prueba-suficientemente-larga";
const PUBLISHABLE = "sb_publishable_AbC123xyz";

const kindOf = (status: number | null, body = "") => classifyChatFailure(status, body).kind;

describe("classifyChatFailure · la clave del gateway", () => {
  it("un 401 con «Invalid API key» señala la clave con la que llamamos, no la del proveedor", () => {
    const failure = classifyChatFailure(401, '{"message":"Invalid API key"}');
    expect(failure.kind).toBe("gateway-key");
    expect(failure.status).toBe(401);
  });

  it("reconoce «Invalid JWT» y «No API key found in request»", () => {
    expect(kindOf(401, "Invalid JWT")).toBe("gateway-key");
    expect(kindOf(403, "No API key found in request")).toBe("gateway-key");
  });

  it("no depende de mayúsculas ni del formato del cuerpo", () => {
    expect(kindOf(401, "DOUBLE CHECK THE PROVIDED API KEY")).toBe("gateway-key");
  });
});

describe("classifyChatFailure · la clave del proveedor", () => {
  it("«Provider authentication failed» es del proveedor, que se arregla en otra variable", () => {
    expect(kindOf(401, '{"error":"Provider authentication failed"}')).toBe("provider-key");
  });

  it("«Incorrect API key provided» y «Unauthorized» también", () => {
    expect(kindOf(403, "Incorrect API key provided")).toBe("provider-key");
    expect(kindOf(401, "Unauthorized")).toBe("provider-key");
  });
});

describe("classifyChatFailure · credencial rechazada sin pistas", () => {
  it("un 401/403 sin palabras clave se queda en «auth» y no adivina cuál falló", () => {
    expect(kindOf(403, "blocked by policy")).toBe("auth");
    expect(kindOf(401, "")).toBe("auth");
  });
});

describe("classifyChatFailure · 402, 404, 429 y 5xx", () => {
  it("402 es que la clave se quedó sin créditos", () => {
    expect(kindOf(402, '{"error":"insufficient_quota"}')).toBe("credits");
  });

  it("404 es que la función de chat no existe en ese proyecto", () => {
    expect(kindOf(404, '{"code":"NOT_FOUND"}')).toBe("not-found");
  });

  it("429 es el límite de peticiones del proveedor", () => {
    expect(kindOf(429, "Too Many Requests")).toBe("rate-limit");
  });

  it("500, 502 y 503 son fallo del servidor y conservan su estado", () => {
    for (const status of [500, 502, 503]) {
      const failure = classifyChatFailure(status, "upstream boom");
      expect(failure.kind, String(status)).toBe("server");
      expect(failure.status).toBe(status);
    }
  });

  it("un 4xx que no es ninguno de los anteriores es «other»", () => {
    expect(kindOf(400, "bad request")).toBe("other");
    expect(kindOf(418, "")).toBe("other");
  });
});

describe("classifyChatFailure · red", () => {
  it("sin estado no hubo respuesta: es red, diga lo que diga el cuerpo", () => {
    const failure = classifyChatFailure(null);
    expect(failure.kind).toBe("network");
    expect(failure.status).toBeNull();
    expect(failure.snippet).toBe("");
    expect(kindOf(null, "fetch failed: ECONNREFUSED")).toBe("network");
  });
});

describe("scrubError", () => {
  it("tapa un JWT completo", () => {
    const scrubbed = scrubError(`token ${JWT}`);
    expect(scrubbed).not.toContain(JWT);
    expect(scrubbed).toContain("[clave]");
  });

  it("tapa una clave publishable", () => {
    const scrubbed = scrubError(`apikey: ${PUBLISHABLE}`);
    expect(scrubbed).not.toContain(PUBLISHABLE);
    expect(scrubbed).toContain("[clave]");
  });

  it("aplana espacios y recorta a 180 caracteres", () => {
    expect(scrubError("  dos\n\nlíneas   ")).toBe("dos líneas");
    expect(scrubError("x".repeat(400))).toHaveLength(180);
  });

  it("deja intacto un cuerpo corriente", () => {
    expect(scrubError("Provider authentication failed")).toBe("Provider authentication failed");
  });
});

describe("ninguna lectura devuelve una credencial", () => {
  it("la clasificación no guarda el secreto en el recorte", () => {
    const failure = classifyChatFailure(500, `upstream dijo: ${JWT}`);
    expect(failure.snippet).not.toContain(JWT);
    expect(failure.snippet).toContain("[clave]");
  });

  it("chatFailureDetail limpia aunque el fallo llegue con el secreto crudo", () => {
    const handMade: ChatFailure = { kind: "auth", status: 401, snippet: `token ${JWT}` };
    const detail = chatFailureDetail(handMade);
    expect(detail).not.toContain(JWT);
    expect(detail).toContain("[clave]");
  });

  it("chatFailureDetail limpia también el recorte de la rama genérica", () => {
    const handMade: ChatFailure = { kind: "other", status: 400, snippet: `${PUBLISHABLE} rechazado` };
    const detail = chatFailureDetail(handMade);
    expect(detail).not.toContain(PUBLISHABLE);
    expect(detail).toContain("[clave]");
  });

  it("chatFailureMessage no enseña secretos ni variables de despliegue", () => {
    const handMade: ChatFailure = { kind: "server", status: 502, snippet: `${JWT} ${PUBLISHABLE}` };
    const message = chatFailureMessage(handMade);
    expect(message).not.toContain(JWT);
    expect(message).not.toContain(PUBLISHABLE);
    expect(message).not.toContain("VITE_");
    expect(message).not.toContain("LOVABLE_API_KEY");
  });
});

describe("las dos lecturas salen de la misma clasificación", () => {
  const failures: ChatFailure[] = [
    classifyChatFailure(null),
    classifyChatFailure(401, "Invalid API key"),
    classifyChatFailure(401, "Provider authentication failed"),
    classifyChatFailure(401, ""),
    classifyChatFailure(402, ""),
    classifyChatFailure(404, ""),
    classifyChatFailure(429, ""),
    classifyChatFailure(503, ""),
    classifyChatFailure(400, "bad request"),
  ];
  const expectedKinds: ChatFailureKind[] = [
    "network",
    "gateway-key",
    "provider-key",
    "auth",
    "credits",
    "not-found",
    "rate-limit",
    "server",
    "other",
  ];

  it("cubre las nueve clases, sin huecos ni repetidas", () => {
    const kinds = failures.map((failure) => failure.kind);
    expect([...kinds].sort()).toEqual([...expectedKinds].sort());
    expect(new Set(kinds).size).toBe(expectedKinds.length);
  });

  it("cada clase tiene detalle y mensaje propios: uno mira a Vercel y el otro al usuario", () => {
    const details = failures.map(chatFailureDetail);
    const messages = failures.map(chatFailureMessage);
    expect(new Set(details).size).toBe(expectedKinds.length);
    expect(new Set(messages).size).toBe(expectedKinds.length);
    for (const text of [...details, ...messages]) {
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain("undefined");
      expect(text).not.toContain("null");
    }
  });

  it("el detalle nombra la variable a tocar y el mensaje del usuario no la nombra", () => {
    const gateway = classifyChatFailure(401, "Invalid API key");
    const provider = classifyChatFailure(401, "Provider authentication failed");

    expect(chatFailureDetail(gateway)).toContain("VITE_SUPABASE_ANON_KEY");
    expect(chatFailureDetail(provider)).toContain("LOVABLE_API_KEY");

    for (const text of [chatFailureMessage(gateway), chatFailureMessage(provider)]) {
      expect(text).not.toContain("VITE_");
      expect(text).not.toContain("LOVABLE_API_KEY");
    }
  });

  it("un 401 de la clave del gateway y uno del proveedor no dicen lo mismo", () => {
    const gateway = chatFailureMessage(classifyChatFailure(401, "Invalid API key"));
    const provider = chatFailureMessage(classifyChatFailure(401, "Provider authentication failed"));
    expect(gateway).not.toBe(provider);
  });
});
