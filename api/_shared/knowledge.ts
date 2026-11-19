/**
 * Conocimiento curado que el bot inyecta como bloque de contexto.
 *
 * Origen: `backend/rag/knowledge.ts` (la doctrina de la DAO y la física
 * unificada del proyecto). Se duplica aquí porque el RAG del backend sólo lo
 * lee un orquestador Express que no está desplegado, y el chat de producción
 * corre en Supabase: el conocimiento tiene que viajar al sitio donde se
 * responde, y quien lo manda es el webhook.
 *
 * Reglas:
 *  - Se enruta por palabras clave, no por embeddings: cero dependencias y cero
 *    latencia. Es un RAG de manuales, no de documentos largos.
 *  - Si no hay coincidencia, `null`. Inyectar lore en una pregunta de mercados
 *    empeora la respuesta.
 *  - Un bloque como máximo, recortado a `MAX_KNOWLEDGE_CHARS`, que es el tope
 *    que la función `chat` acepta por bloque de contexto.
 */

export interface KnowledgeBlock {
  id: string;
  /** Cómo se etiqueta en el prompt. */
  title: string;
  text: string;
  /** Palabras que lo activan. Se comparan normalizadas. */
  keywords: string[];
}

/** `MAX_CONTEXT_BLOCK_CHARS` de la función `chat`. */
export const MAX_KNOWLEDGE_CHARS = 4000;

export const KNOWLEDGE_BLOCKS: KnowledgeBlock[] = [
  {
    id: "dao",
    title: "AlienFlowSpace DAO",
    text: [
      "ESTRUCTURA DE ALIENFLOWSPACE DAO:",
      "- Ecosistema descentralizado que integra Ai Tor, DApps y un exchange descentralizado (DEX).",
      "- Objetivo: unificar Web3/Web4/Web5 con los principios de la física unificada para lograr máxima eficiencia y sostenibilidad ambiental, energética y financiera.",
      "- Colectivo: ΔlieπFlΦw DAO Synapse. Frecuencia operativa: 3-6-9 Hz.",
      "- Ai Tor.v69 es su inteligencia central: enruta, investiga y ejecuta tareas del ecosistema.",
      "- No hay promesas de rendimiento financiero: cualquier cifra de mercado debe venir de una herramienta consultada en el turno, nunca de la memoria.",
    ].join("\n"),
    keywords: [
      "dao",
      "alienflow",
      "alienflowspace",
      "synapse",
      "dex",
      "tokenomica",
      "tokenomics",
      "gobernanza",
      "propuesta",
      "propuestas",
      "tesoreria",
    ],
  },
  {
    id: "physics",
    title: "Núcleo teórico (física unificada)",
    text: [
      "NÚCLEO TEÓRICO DE FÍSICA UNIFICADA (marco del proyecto, no física aceptada):",
      "- La ruptura geométrica propone un reescalado de la proporción áurea desde el valor clásico hasta 16.18…",
      "- Esa constante es la base que el proyecto usa para hablar de optimización de datos y energía.",
      "- Nikola Tesla y la geometría 3-6-9 son la estructura subyacente de esta arquitectura de singularidad.",
      "- Es un marco propio del colectivo: al explicarlo, dilo como tal y no como consenso científico.",
    ].join("\n"),
    keywords: [
      "16.18",
      "proporcion aurea",
      "aurea",
      "tesla",
      "3-6-9",
      "369",
      "fisica unificada",
      "neutrino",
      "neutrinos",
      "alquimia",
      "singularidad",
      "resonancia",
    ],
  },
];

/** Sin acentos, sin mayúsculas, espacios simples. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Puntúa cada bloque por palabras clave presentes. Una palabra de una sola
 * letra no cuenta, y las frases se buscan como subcadena normalizada.
 */
export function scoreBlocks(text: string): Array<{ block: KnowledgeBlock; score: number }> {
  const haystack = ` ${normalize(text)} `;
  return KNOWLEDGE_BLOCKS.map((block) => {
    const score = block.keywords.reduce((total, keyword) => {
      const needle = normalize(keyword);
      if (needle.length < 2) return total;
      return haystack.includes(` ${needle} `) || haystack.includes(` ${needle}`) ? total + 1 : total;
    }, 0);
    return { block, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * El bloque que corresponde a la pregunta, o `null` si no hay coincidencia.
 * Se devuelve ya con el título y recortado al tope de la función `chat`.
 */
export function retrieveKnowledge(text: string): string | null {
  if (!text || !text.trim()) return null;
  const best = scoreBlocks(text)[0];
  if (!best || best.score === 0) return null;
  const body = best.block.text.trim().slice(0, MAX_KNOWLEDGE_CHARS - 200);
  return `[CONOCIMIENTO — ${best.block.title}]\n${body}`;
}
