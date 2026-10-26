/**
 * Catalog of what AI Tor can actually consult, and the rule that decides when.
 *
 * The app already ships eleven Edge Functions that answer real questions — web
 * search, crypto prices, GitHub repositories, OSINT briefings, space weather —
 * but until now nothing in the chat called any of them: `agentTools.ts` was
 * written and then never imported, so every answer came from the model's
 * training data alone. This module is the missing wire.
 *
 * Detection is a deliberate, testable rule set rather than a model call: it runs
 * before the request, costs nothing, and can be asserted in a unit test. A skill
 * only fires when its own pattern matches, so an ordinary question is still sent
 * with no context at all.
 */

export type SkillId = "web" | "market" | "repo" | "osint" | "spaceWeather";

export interface SkillDefinition {
  id: SkillId;
  /** Shown on the message chip, so the transcript says what was consulted. */
  label: string;
  /** One line handed to the model, describing the kind of data it will receive. */
  gives: string;
  /** Ordered matchers; any hit routes to the skill. */
  patterns: RegExp[];
}

/** Cryptocurrency words → CoinGecko ids, shared by routing and execution. */
export const COIN_IDS: Record<string, string> = {
  bitcoin: "bitcoin", btc: "bitcoin",
  ethereum: "ethereum", eth: "ethereum",
  solana: "solana", sol: "solana",
  bnb: "binancecoin",
  xrp: "ripple",
  cardano: "cardano", ada: "cardano",
  dogecoin: "dogecoin", doge: "dogecoin",
  polkadot: "polkadot", dot: "polkadot",
  avalanche: "avalanche-2", avax: "avalanche-2",
  polygon: "matic-network", matic: "matic-network",
  chainlink: "chainlink", link: "chainlink",
  litecoin: "litecoin", ltc: "litecoin",
  tron: "tron", trx: "tron",
};

/**
 * Order matters: the specific skills come before the broad ones, so a question
 * about "tormenta solar" reaches space weather instead of the generic web
 * search, and "precio de bitcoin" never triggers a search engine call.
 */
export const SKILLS: SkillDefinition[] = [
  {
    id: "spaceWeather",
    label: "Clima espacial",
    gives: "índice Kp, viento solar, fulguraciones y tormentas geomagnéticas (NOAA, ahora)",
    patterns: [
      /\b(kp|índice kp|indice kp)\b/i,
      /\b(aurora|auroras|geomagnét\w*|magnetosfera)\b/i,
      /\b(tormenta|fulguraci\w*|erupci\w*)\s+(solar|geomagnética|geomagnetica)\b/i,
      /\b(viento solar|clima espacial|radiaci[oó]n solar|mancha solar)\b/i,
    ],
  },
  {
    id: "market",
    label: "Mercado",
    gives: "precio y variación 24 h de las criptomonedas nombradas (CoinGecko, ahora)",
    patterns: [
      /\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|cardano|ada|dogecoin|doge|polkadot|dot|avalanche|avax|polygon|matic|chainlink|link|litecoin|ltc|tron|trx)\b/i,
      /\b(precio|price|cotizaci[oó]n|market cap|capitalizaci[oó]n)\b/i,
    ],
  },
  {
    id: "repo",
    label: "Repositorio",
    gives: "metadatos, árbol de archivos y últimos commits del repositorio de GitHub citado",
    patterns: [
      /github\.com\/[^\s/]+\/[^\s#?]+/i,
      // "repositorio owner/repo" and "owner/repo del repositorio". Both sides must
      // start with a letter so a path or a date is not mistaken for a repository.
      /\b(repositorio|repo|proyecto)\b.*\b([A-Za-z][\w.-]*)\/([A-Za-z][\w.-]*)\b/i,
      /\b([A-Za-z][\w.-]*)\/([A-Za-z][\w.-]*)\b.*\b(repositorio|repo|proyecto)\b/i,
    ],
  },
  {
    id: "osint",
    label: "OSINT",
    gives: "titulares recientes por categoría: finanzas, inteligencia, conflicto, geopolítica",
    patterns: [
      /\b(osint|inteligencia de fuentes abiertas)\b/i,
      /\b(uap|ovni|ovnis|pent[aá]gono|avistamiento)\b/i,
      /\b(geopol[ií]tic\w*|sanciones|conflicto b[eé]lico|guerra)\b/i,
      /\b(noticias|actualidad|última hora|ultima hora)\b/i,
    ],
  },
  {
    id: "web",
    label: "Web",
    gives: "resultados de búsqueda recientes con título, URL y extracto",
    patterns: [
      /\b(busca|b[uú]scame|buscar|search|investiga|googlea)\b/i,
      /\b(qu[eé] es|qui[eé]n es|cu[aá]ndo (sali[oó]|se lanz[oó])|fuente|referencia)\b/i,
      /\b(web|internet|en l[ií]nea|online)\b/i,
    ],
  },
];

/** Tokens that need the network even though no keyword rule matched. */
const EXTERNAL_REFERENCE = /\b(https?:\/\/[^\s]+)\b/i;

/** Hard cap: three sources of context is already a lot for one turn. */
export const MAX_SKILLS_PER_TURN = 3;

/**
 * Which skills this turn should consult. Pure and deterministic so it can be
 * tested: same text in, same skills out, always capped.
 */
export function routeSkills(text: string, max = MAX_SKILLS_PER_TURN): SkillId[] {
  const matched = SKILLS.filter((skill) => skill.patterns.some((pattern) => pattern.test(text))).map(
    (skill) => skill.id,
  );

  // A bare URL is a request to read it, even when no keyword says so.
  if (matched.length === 0 && EXTERNAL_REFERENCE.test(text)) {
    return ["web"];
  }

  return matched.slice(0, max);
}

/** CoinGecko ids mentioned in the text, in the order they appear. */
export function extractCoinIds(text: string): string[] {
  const found: string[] = [];
  for (const [word, id] of Object.entries(COIN_IDS)) {
    if (!new RegExp(`\\b${word}\\b`, "i").test(text)) continue;
    if (!found.includes(id)) found.push(id);
  }
  return found;
}

/** GitHub owner/repo mentioned in the text, if any. */
export function extractRepo(text: string): { owner: string; repo: string } | null {
  const url = text.match(/github\.com\/([^/\s]+)\/([^\s#?)]+)/i);
  if (url) return { owner: url[1], repo: url[2].replace(/\.git$/, "") };
  const short = text.match(/\b([A-Za-z][\w.-]*)\/([A-Za-z][\w.-]*)\b/);
  if (short && !short[1].includes(".")) return { owner: short[1], repo: short[2] };
  return null;
}

export const skillLabel = (id: SkillId): string => SKILLS.find((s) => s.id === id)?.label ?? id;
