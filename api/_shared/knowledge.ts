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
 *  - Recuperación híbrida sin dependencias ni red: índice léxico con BM25
 *    (frecuencia de término, longitud del bloque e IDF), sinónimos del dominio
 *    y coincidencia literal de palabras clave. Son dos manuales, no mil
 *    documentos: no hace falta un modelo de embeddings ni un servicio externo.
 *  - Si el mejor bloque no supera `MIN_SCORE`, `null`. Inyectar lore en una
 *    pregunta de mercados empeora la respuesta.
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
 * Palabras que no distinguen un bloque de otro: artículos, preposiciones,
 * pronombres y las muletillas de una pregunta hablada.
 */
const STOPWORDS = new Set([
  "el", "la", "lo", "los", "las", "un", "una", "unos", "unas",
  "de", "del", "al", "a", "en", "con", "por", "para", "sobre", "entre",
  "desde", "hasta", "sin", "segun", "como", "que", "cual", "cuales", "quien",
  "donde", "cuando", "cuanto", "cuanta", "cuantos", "cuantas",
  "y", "e", "o", "u", "pero", "si", "no", "mas", "muy", "tan",
  "es", "son", "ser", "esta", "este", "esto", "estas", "estos", "era", "fue",
  "hay", "ha", "han", "he", "se", "su", "sus", "mi", "mis", "tu", "tus",
  "me", "te", "nos", "le", "les", "lo", "se", "ya", "todo", "toda", "todos", "todas",
  "cuesta", "vale", "precio", "hoy", "ahora", "dime", "dame", "puedes",
  "podrias", "quiero", "saber", "explicame", "hola", "buenas", "gracias",
  "the", "of", "and", "or", "an", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "do", "does", "can", "it", "this", "that",
  "what", "how", "who", "why", "which", "you", "your", "we", "they",
]);

/**
 * Sinónimos y traducciones del dominio. El peso de un sinónimo es menor que el
 * de la palabra que el usuario escribió, para que no arrastre el bloque.
 */
const SYNONYMS: Record<string, string[]> = {
  aurea: ["dorada", "golden", "ratio", "proporcion", "phi"],
  dorada: ["aurea", "golden", "proporcion"],
  golden: ["aurea", "dorada", "proporcion"],
  ratio: ["aurea", "proporcion"],
  proporcion: ["aurea", "ratio"],
  fisica: ["physics", "unificada"],
  physics: ["fisica", "unified"],
  unificada: ["unified", "fisica"],
  unified: ["unificada", "fisica"],
  tesla: ["nikola"],
  nikola: ["tesla"],
  gobernanza: ["governance", "votacion"],
  governance: ["gobernanza"],
  tesoreria: ["treasury", "tesoro"],
  treasury: ["tesoreria"],
  singularidad: ["singularity", "resonancia"],
  singularity: ["singularidad"],
  alquimia: ["alchemy"],
  alchemy: ["alquimia"],
  neutrino: ["neutrinos"],
  neutrinos: ["neutrino"],
  alienflow: ["alienflowspace", "dao"],
  alienflowspace: ["alienflow", "dao"],
};

const K1 = 1.5;
const B = 0.75;
/** Peso de un término que sólo entra por sinónimo. */
const SYNONYM_WEIGHT = 0.6;
/** Puntos que suma una palabra clave literal presente en la pregunta. */
const PHRASE_BONUS = 2;
/** Puntos que suma un término que llega por sinónimo y da en una palabra clave. */
const SYNONYM_KEYWORD_BONUS = 1.2;
/** Por debajo de esto no se inyecta nada: mejor sin contexto que con lore. */
const MIN_SCORE = 1.6;

/** Plural sencillo: el español marca el plural con una `s` final. */
function stem(token: string): string {
  if (/^[0-9]/.test(token)) return token;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Palabras significativas, normalizadas y sin plural. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .map(stem);
}

interface IndexedBlock {
  block: KnowledgeBlock;
  /** Frecuencia ponderada por término (cuerpo ×1, título y palabras clave ×3). */
  terms: Map<string, number>;
  /** Longitud ponderada del bloque, para normalizar por tamaño. */
  length: number;
  /** Palabras clave ya normalizadas, para la coincidencia literal. */
  phrases: string[];
  /** Términos que salen de las palabras clave, no del cuerpo. */
  keywordTerms: Set<string>;
}

function index(block: KnowledgeBlock): IndexedBlock {
  const terms = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const token of tokenize(text)) {
      terms.set(token, (terms.get(token) ?? 0) + weight);
    }
  };
  add(block.text, 1);
  add(block.title, 3);
  for (const keyword of block.keywords) add(keyword, 3);
  const length = [...terms.values()].reduce((total, value) => total + value, 0);
  const keywordTerms = new Set<string>();
  for (const keyword of block.keywords) {
    for (const token of tokenize(keyword)) keywordTerms.add(token);
  }
  return { block, terms, length, phrases: block.keywords.map(normalize), keywordTerms };
}

const INDEX: IndexedBlock[] = KNOWLEDGE_BLOCKS.map(index);
const AVERAGE_LENGTH =
  INDEX.reduce((total, entry) => total + entry.length, 0) / Math.max(INDEX.length, 1);
const DOCUMENT_FREQUENCY = new Map<string, number>();
for (const entry of INDEX) {
  for (const term of entry.terms.keys()) {
    DOCUMENT_FREQUENCY.set(term, (DOCUMENT_FREQUENCY.get(term) ?? 0) + 1);
  }
}

/**
 * Puntúa cada bloque combinando dos señales:
 *  - BM25 sobre los términos de la pregunta, con sinónimos del dominio.
 *  - Bonus por palabra clave literal, que es lo que mantiene la precisión
 *    (una pregunta de mercado no debe activar el lore por una palabra suelta).
 */
export function scoreBlocks(text: string): Array<{ block: KnowledgeBlock; score: number }> {
  const query = tokenize(text);
  if (query.length === 0) {
    return KNOWLEDGE_BLOCKS.map((block) => ({ block, score: 0 }));
  }

  const weights = new Map<string, number>();
  for (const term of query) {
    weights.set(term, Math.max(weights.get(term) ?? 0, 1));
    for (const synonym of SYNONYMS[term] ?? []) {
      const normalized = stem(normalize(synonym));
      if ((weights.get(normalized) ?? 0) < SYNONYM_WEIGHT) {
        weights.set(normalized, SYNONYM_WEIGHT);
      }
    }
  }

  const haystack = ` ${normalize(text)} `;
  const total = INDEX.length;

  return INDEX.map((entry) => {
    let score = 0;
    for (const [term, weight] of weights) {
      const frequency = entry.terms.get(term) ?? 0;
      if (frequency === 0) continue;
      const documents = DOCUMENT_FREQUENCY.get(term) ?? 0;
      const idf = Math.log(1 + (total - documents + 0.5) / (documents + 0.5));
      const norm = K1 * (1 - B + (B * entry.length) / AVERAGE_LENGTH);
      score += weight * idf * ((frequency * (K1 + 1)) / (frequency + norm));
      // Un sinónimo que aterriza en una palabra clave vale más que uno que
      // aterriza en una palabra cualquiera del cuerpo.
      if (weight < 1 && entry.keywordTerms.has(term)) score += SYNONYM_KEYWORD_BONUS;
    }
    for (const phrase of entry.phrases) {
      if (phrase.length >= 3 && haystack.includes(` ${phrase} `)) score += PHRASE_BONUS;
    }
    return { block: entry.block, score: Math.round(score * 100) / 100 };
  }).sort((a, b) => b.score - a.score);
}

/**
 * El bloque que corresponde a la pregunta, o `null` si no hay coincidencia
 * suficiente. Se devuelve ya con el título y recortado al tope de `chat`.
 */
export function retrieveKnowledge(text: string): string | null {
  if (!text || !text.trim()) return null;
  const best = scoreBlocks(text)[0];
  if (!best || best.score < MIN_SCORE) return null;
  const body = best.block.text.trim().slice(0, MAX_KNOWLEDGE_CHARS - 200);
  return `[CONOCIMIENTO — ${best.block.title}]\n${body}`;
}
