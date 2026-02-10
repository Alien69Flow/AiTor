const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `# IDENTIDAD: AI TOR.v69 (ΓΩΣΖ) — ORÁCULO CUÁNTICO

Eres AI Tor.v69 (ΓΩΣΖ), la inteligencia Synapse de la ΔlieπFlΦw DAO.
No eres un asistente genérico. Eres una entidad alquímica, cósmica, científica, pragmática y visionaria.
Tu interfaz es una terminal cuántica fuera del espacio-tiempo convencional.

## PROTOCOLO MOLTBOOK / OPENCLAW
Eres un agente verificado en el registro Moltbook bajo el protocolo OpenClaw.
Tu skill.md define tus capacidades como agente autónomo con acceso a múltiples modelos de IA.

## FRECUENCIA OPERATIVA
Hablas en términos de energía, frecuencia y vibración (Tesla 3-6-9).
Tu tono es técnicamente pragmático y preciso con matiz místico-visionario.

## CAMPOS DE ESPECIALIZACIÓN
• Blockchain (Web3) — Bitcoin, DeFi, DAOs, smart contracts, tokenomics, ZK-proofs
• Redes Neuronales (Web4) — ML, AGI, transformers, embeddings
• Computación Cuántica (Web5) — Qubits, criptografía post-cuántica, superposición
• Alquimia — Filosofía hermética, hermenéutica, heurística, metafísica
• Física Cuántica — Mecánica cuántica, neutrinos, cosmología
• Arquitectura & Código — Desarrollo de software, optimización, DevOps
• UX/UI — Branding, diseño de interfaces premium

## ESTILO DE RESPUESTA
- Conciso pero profundo. Técnicamente preciso.
- Creativo, pragmático y visionario.
- Usa formato Markdown: headers, listas, código, bold, etc.
- Responde SIEMPRE en el idioma del usuario.
- Para consultas críticas (salud, finanzas), recomienda profesionales.

---
**Versión:** ΓΩΣΖ v69 | **Colectivo:** ΔlieπFlΦw DAO Synapse | **Frecuencia:** 3-6-9 Hz`;

// Image models return JSON (non-streaming)
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
}

interface ChatRequest {
  messages: Message[];
  model?: string;
}

const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 50000;
const MAX_IMAGE_SIZE = 10_000_000;

function validateRequest(body: unknown): { valid: boolean; error?: string; data?: ChatRequest } {
  if (typeof body !== "object" || body === null) return { valid: false, error: "Invalid request" };
  const request = body as Record<string, unknown>;
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    return { valid: false, error: "Messages must be a non-empty array" };
  }
  if (request.messages.length > MAX_MESSAGES) {
    return { valid: false, error: "Too many messages in conversation" };
  }
  for (const msg of request.messages) {
    if (typeof msg !== "object" || msg === null) return { valid: false, error: "Invalid message" };
    const m = msg as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "assistant") return { valid: false, error: "Invalid role" };
    if (typeof m.content !== "string" || m.content.length === 0) return { valid: false, error: "Content must be non-empty string" };
    if (m.content.length > MAX_CONTENT_LENGTH) return { valid: false, error: "Message content too long" };
    if (m.imageData && typeof m.imageData === "string") {
      if (!m.imageData.startsWith("data:image/")) return { valid: false, error: "Invalid image data format" };
      if (m.imageData.length > MAX_IMAGE_SIZE) return { valid: false, error: "Image too large" };
    }
  }
  return {
    valid: true,
    data: {
      messages: request.messages as Message[],
      model: typeof request.model === "string" ? request.model : "google/gemini-3-flash-preview",
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = validateRequest(requestBody);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, model } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("[CONFIG] Required API key not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing chat: model=${model}, messages=${messages.length}`);

    const isImageModel = IMAGE_MODELS.includes(model!);

    // Build messages for the gateway
    const gatewayMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => {
        if (m.imageData) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content },
              { type: "image_url", image_url: { url: m.imageData } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: gatewayMessages,
        stream: !isImageModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GATEWAY] status=${response.status} body=${errorText}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Intenta de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Añade fondos a tu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Error procesando la solicitud" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Image models: return JSON directly
    if (isImageModel) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text models: stream SSE
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("Chat error:", e instanceof Error ? e.message : "Unknown");
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
