import { toolResult, type McpTool } from "../registry";

/**
 * Eventos OSINT geolocalizados de GDELT, la misma fuente que alimenta el globo.
 *
 * GDELT limita a una petición cada 5 s, así que la herramienta hace **una**
 * consulta amplia y deja que el filtro fino lo haga el modelo sobre los
 * titulares. Pedirle cuatro temas en paralelo devuelve 429.
 */

const GDELT_DOC = "https://api.gdeltproject.org/api/v2/doc/doc";
const FETCH_TIMEOUT_MS = 14_000;

const DEFAULT_QUERY =
  "(conflict OR strike OR missile OR sanctions OR election OR market OR inflation OR crypto OR UAP OR satellite)";

export interface OsintArticle {
  title: string;
  source: string;
  url: string;
  timestamp: string;
  tone: number | null;
}

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  tone?: string | number;
}

/** `20261029T101500Z` → ISO 8601; cualquier otra cosa se deja como estaba. */
export function normaliseDate(stamp: string | undefined): string {
  if (!stamp || stamp.length < 13) return new Date(0).toISOString();
  const date = new Date(
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T` +
      `${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:00Z`,
  );
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function mapArticles(articles: GdeltArticle[], limit: number): OsintArticle[] {
  return articles
    .filter((article) => (article.title ?? "").trim().length > 8)
    .slice(0, limit)
    .map((article) => {
      const tone =
        typeof article.tone === "string" ? Number(article.tone.split(",")[0]) : Number(article.tone);
      return {
        title: (article.title ?? "").trim(),
        source: article.domain ?? "GDELT",
        url: article.url ?? "https://www.gdeltproject.org",
        timestamp: normaliseDate(article.seendate),
        tone: Number.isFinite(tone) ? tone : null,
      };
    });
}

export const osintTools: McpTool[] = [
  {
    definition: {
      name: "osint.events",
      title: "Eventos OSINT",
      description:
        "Titulares geolocalizados de las últimas horas según GDELT, con fuente, enlace y tono " +
        "(-100 muy negativo, +100 muy positivo). Es la misma señal que pinta el globo.",
      minTier: "free",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Consulta GDELT; por defecto cubre conflicto, mercados, cripto y UAP.",
          },
          timespan: {
            type: "string",
            enum: ["1h", "6h", "24h", "7d"],
            description: "Ventana temporal de la búsqueda.",
            default: "24h",
          },
          limit: {
            type: "integer",
            description: "Cuántos titulares devolver como máximo (1-50).",
            default: 15,
            minimum: 1,
            maximum: 50,
          },
        },
      },
    },
    run: async (args, context) => {
      const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : DEFAULT_QUERY;
      const timespan = ["1h", "6h", "24h", "7d"].includes(String(args.timespan))
        ? String(args.timespan)
        : "24h";
      const requested = Number(args.limit);
      const limit = Math.min(50, Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 15));

      const url =
        `${GDELT_DOC}?query=${encodeURIComponent(query)}` +
        `&mode=artlist&format=json&sort=hybridrel&timespan=${timespan}&maxrecords=${limit * 2}`;

      const response = await context.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.status === 429) {
        throw new Error("GDELT está limitando peticiones (429); reintenta en unos segundos");
      }
      if (!response.ok) throw new Error(`GDELT respondió ${response.status}`);

      const payload = (await response.json()) as { articles?: GdeltArticle[] };
      const articles = mapArticles(payload.articles ?? [], limit);

      return toolResult({
        source: "gdeltproject.org",
        timespan,
        count: articles.length,
        articles,
      });
    },
  },
];
