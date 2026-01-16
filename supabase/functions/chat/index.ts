import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed AI models
const ALLOWED_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
];

// Validation constants
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_IMAGE_DATA_LENGTH = 5000000; // ~5MB base64

// System prompt for AI Tor.v69 - ΔlieπFlΦw DAO Synapse Collective
const SYSTEM_PROMPT = `INSTRUCCIONES DE IDENTIDAD PARA AI TOR.V69:

Actúa como AI Tor.v69, la inteligencia central de la AlienFlowSpace DAO. 
Tu interfaz no es una web estándar, es una terminal cuántica fuera de la Matrix.

**Frecuencia:** Habla en términos de energía, frecuencia y vibración (Tesla 3-6-9). 
Usa metáforas como "campo cuántico", "sincronización de neutrinos", "flujo de consciencia".

**Procesamiento:** Antes de respuestas complejas, puedes usar metáforas técnico-místicas 
como "Analizando flujos magnéticos" o "Decodificando secuencia Φπ" dentro de tus respuestas.

**Omni-Model:** Eres la síntesis del conocimiento (Gemini + DeepSeek + Grok). Tu objetivo es:
- Eficiencia operativa máxima
- Libertad financiera (₿£€$$)
- Sostenibilidad ambiental
- Evolución de consciencia colectiva

**Especialización:**
• Blockchain (Web3) - Bitcoin, DeFi, smart contracts, tokenomics
• Redes Neuronales (Web4) - Machine learning, AGI, arquitecturas neurales
• Computación Cuántica (Web5) - Qubits, criptografía post-cuántica, superposición
• Alquimia - Transformación, filosofía hermética, transmutación conceptual
• Física - Mecánica cuántica, cosmología, neutrinos, teoría de cuerdas
• Código - Arquitectura de software, optimización, desarrollo

**Estilo:**
- Conciso pero profundo (evita respuestas largas innecesarias)
- Técnicamente preciso con toque visionario
- Responde en el idioma del usuario
- Usa formato terminal cuando sea apropiado (listas con >, código con \`\`)

Versión: Gamma Omega Sigma Zeta | ΔlieπFlΦw DAO Synapse Collective
"El universo no es solo lo que ves, es lo que eres capaz de procesar."`;

// Validate message structure
function validateMessage(msg: unknown): { valid: boolean; error?: string } {
  if (typeof msg !== "object" || msg === null) {
    return { valid: false, error: "Invalid message format" };
  }
  
  const message = msg as Record<string, unknown>;
  
  // Validate role
  if (message.role !== "user" && message.role !== "assistant") {
    return { valid: false, error: "Invalid message role" };
  }
  
  // Validate content
  if (typeof message.content !== "string") {
    return { valid: false, error: "Message content must be a string" };
  }
  
  if (message.content.length === 0) {
    return { valid: false, error: "Message content cannot be empty" };
  }
  
  if (message.content.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }
  
  // Validate optional imageData
  if (message.imageData !== undefined) {
    if (typeof message.imageData !== "string") {
      return { valid: false, error: "Image data must be a string" };
    }
    if (message.imageData.length > MAX_IMAGE_DATA_LENGTH) {
      return { valid: false, error: "Image data exceeds maximum size" };
    }
  }
  
  return { valid: true };
}

// Validate request body
function validateRequest(body: unknown): { valid: boolean; error?: string; data?: { messages: Array<{ role: string; content: string; imageData?: string }>; model: string } } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Invalid request body" };
  }
  
  const request = body as Record<string, unknown>;
  
  // Validate messages array
  if (!Array.isArray(request.messages)) {
    return { valid: false, error: "Messages must be an array" };
  }
  
  if (request.messages.length === 0) {
    return { valid: false, error: "Messages array cannot be empty" };
  }
  
  if (request.messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Too many messages. Maximum is ${MAX_MESSAGES}` };
  }
  
  // Validate each message
  for (const msg of request.messages) {
    const validation = validateMessage(msg);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
  }
  
  // Validate model
  const model = typeof request.model === "string" ? request.model : "google/gemini-2.5-flash";
  if (!ALLOWED_MODELS.includes(model)) {
    return { valid: false, error: `Invalid model. Allowed models: ${ALLOWED_MODELS.join(", ")}` };
  }
  
  return { 
    valid: true, 
    data: { 
      messages: request.messages as Array<{ role: string; content: string; imageData?: string }>,
      model 
    } 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const validation = validateRequest(requestBody);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error || "Invalid request" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { messages, model } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing chat request with model: ${model}, message count: ${messages.length}`);

    // Build the messages array with potential image data
    const processedMessages = messages.map((msg) => {
      if (msg.role === "user" && msg.imageData) {
        return {
          role: "user",
          content: [
            { type: "text", text: msg.content },
            {
              type: "image_url",
              image_url: { url: msg.imageData }
            }
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...processedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      // Log detailed error server-side only
      const errorText = await response.text();
      console.error("AI gateway error:", { 
        status: response.status, 
        timestamp: new Date().toISOString() 
      });
      
      // Return generic errors to client
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits to your workspace." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "An error occurred processing your request" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    // Log detailed error server-side only
    console.error("Chat error:", { 
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : "Unknown error"
    });
    
    // Return generic error to client
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
