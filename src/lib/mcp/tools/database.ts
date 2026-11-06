import { toolResult, type McpDatabase, type McpTool } from "../registry";

/**
 * Lectura de las tablas propias del usuario.
 *
 * La lista de tablas y de columnas es fija: el modelo no elige libremente qué
 * consultar. Y aunque eligiera, no podría saltarse nada, porque la consulta se
 * ejecuta con el cliente de la sesión y el **RLS** del proyecto de identidad
 * decide qué filas existen para ese usuario. Aquí sólo se acota la superficie.
 */

/** Tablas legibles y sus columnas permitidas. */
export const READABLE_TABLES = {
  profiles: ["id", "display_name", "tier", "created_at", "updated_at"],
  user_credits: ["user_id", "paid_tier", "used", "updated_at"],
} as const;

export type ReadableTable = keyof typeof READABLE_TABLES;

export function isReadableTable(value: unknown): value is ReadableTable {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(READABLE_TABLES, value);
}

/** Columnas pedidas, intersectadas con las permitidas; todas si no se pide nada. */
export function resolveColumns(table: ReadableTable, requested: unknown): string[] {
  const allowed = READABLE_TABLES[table];
  if (typeof requested !== "string" || !requested.trim()) return [...allowed];
  const wanted = requested
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  const unknown = wanted.filter((column) => !(allowed as readonly string[]).includes(column));
  if (unknown.length > 0) {
    throw new Error(`Columnas no permitidas en ${table}: ${unknown.join(", ")}`);
  }
  return wanted;
}

/** Filtros: sólo por columnas permitidas y con igualdad simple. */
export function resolveFilters(table: ReadableTable, raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = READABLE_TABLES[table] as readonly string[];
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.includes(key)) throw new Error(`No se puede filtrar ${table} por ${key}`);
    if (value === null || value === undefined) continue;
    filters[key] = String(value);
  }
  return filters;
}

export const databaseTools: McpTool[] = [
  {
    definition: {
      name: "db.select",
      title: "Leer mis datos",
      description:
        "Lee tu perfil y tus créditos. Sólo devuelve filas que tu sesión puede ver según RLS, " +
        "así que nunca expone datos de otra cuenta.",
      // Leer la propia fila no debería costar un plan, pero el catálogo de
      // tablas crecerá con datos de mercado: se deja en `pro` para que el plan
      // gratuito no pueda usarlo como API de consulta.
      minTier: "pro",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: Object.keys(READABLE_TABLES),
            description: "Tabla a leer.",
          },
          columns: {
            type: "string",
            description: "Columnas separadas por comas; por defecto todas las permitidas.",
          },
          filters: {
            type: "object",
            description: "Igualdades por columna, p. ej. {\"tier\":\"pro\"}.",
          },
          limit: {
            type: "integer",
            description: "Máximo de filas (1-50).",
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
        required: ["table"],
      },
    },
    run: async (args, context) => {
      const db: McpDatabase | undefined = context.db;
      if (!db) throw new Error("Esta ejecución no tiene acceso a la base de datos");

      if (!isReadableTable(args.table)) {
        throw new Error(`Tabla no permitida: ${String(args.table)}`);
      }
      const table = args.table;
      const columns = resolveColumns(table, args.columns);
      const filters = resolveFilters(table, args.filters);
      const requested = Number(args.limit);
      const limit = Math.min(50, Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 10));

      const rows = await db.select(table, columns.join(","), limit, filters);
      return toolResult({ table, columns, count: rows.length, rows });
    },
  },
];
