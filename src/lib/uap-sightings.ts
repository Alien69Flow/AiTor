import type { Tables } from "@/integrations/supabase/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export type UapSightingRow = Tables<"uap_sightings">;

type UapTableStatus = "unknown" | "available" | "missing";

let uapTableStatus: UapTableStatus = "unknown";

function getPublicHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    ...extra,
  };
}

/**
 * The URL and the publishable key come from the Supabase client, not from
 * `import.meta.env` directly.
 *
 * Reading the environment here meant that any build without
 * `VITE_SUPABASE_URL` — CI, a preview deployment, a local build with a partial
 * `.env` — returned `null` and the registry silently fell back to the frozen
 * 2022 NUFORC mirror even though the table held newer reports. The client
 * already carries the fallbacks the rest of the app relies on.
 */
function getUapTableUrl() {
  return `${SUPABASE_URL}/rest/v1/uap_sightings`;
}

function isMissingTableResponse(status: number, body: string) {
  return status === 404 || body.includes("PGRST205") || body.includes("uap_sightings");
}

export function isUapSightingsTableMissing() {
  return uapTableStatus === "missing";
}

export async function fetchUapSightingsRows() {
  if (uapTableStatus === "missing") return [] as UapSightingRow[];

  const tableUrl = getUapTableUrl();

  try {
    const response = await fetch(
      `${tableUrl}?select=*&lat=not.is.null&lon=not.is.null&order=date_reported.desc`,
      { headers: getPublicHeaders() }
    );

    if (!response.ok) {
      const body = await response.text();
      if (isMissingTableResponse(response.status, body)) {
        uapTableStatus = "missing";
      }
      return [] as UapSightingRow[];
    }

    uapTableStatus = "available";
    return (await response.json()) as UapSightingRow[];
  } catch {
    return [] as UapSightingRow[];
  }
}

/**
 * Every stored report, including the ones without coordinates.
 *
 * Lists that do not place anything on the map must use this: the coordinate
 * filter in `fetchUapSightingsRows` silently hides rows that the table does
 * contain, which is how the anomaly feed ended up empty while the database had
 * records.
 */
export async function fetchAllUapSightingsRows() {
  if (uapTableStatus === "missing") return [] as UapSightingRow[];

  const tableUrl = getUapTableUrl();

  try {
    const response = await fetch(`${tableUrl}?select=*&order=date_reported.desc`, {
      headers: getPublicHeaders(),
    });

    if (!response.ok) {
      const body = await response.text();
      if (isMissingTableResponse(response.status, body)) {
        uapTableStatus = "missing";
      }
      return [] as UapSightingRow[];
    }

    uapTableStatus = "available";
    return (await response.json()) as UapSightingRow[];
  } catch {
    return [] as UapSightingRow[];
  }
}

export async function fetchUapSightingsCount() {
  if (uapTableStatus === "missing") return 0;

  const tableUrl = getUapTableUrl();

  try {
    const response = await fetch(`${tableUrl}?select=id`, {
      method: "HEAD",
      headers: getPublicHeaders({ Prefer: "count=exact" }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (isMissingTableResponse(response.status, body)) {
        uapTableStatus = "missing";
      }
      return 0;
    }

    uapTableStatus = "available";
    const contentRange = response.headers.get("content-range") ?? "0-0/0";
    const [, total = "0"] = contentRange.split("/");
    return Number.parseInt(total, 10) || 0;
  } catch {
    return 0;
  }
}