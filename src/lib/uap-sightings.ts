import type { Tables } from "@/integrations/supabase/types";

export type UapSightingRow = Tables<"uap_sightings">;

type UapTableStatus = "unknown" | "available" | "missing";

let uapTableStatus: UapTableStatus = "unknown";

function getPublicHeaders(extra: HeadersInit = {}): HeadersInit {
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    "";

  return {
    "Content-Type": "application/json",
    ...(publishableKey
      ? {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        }
      : {}),
    ...extra,
  };
}

function getUapTableUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return baseUrl ? `${baseUrl}/rest/v1/uap_sightings` : null;
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
  if (!tableUrl) return [] as UapSightingRow[];

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

export async function fetchUapSightingsCount() {
  if (uapTableStatus === "missing") return 0;

  const tableUrl = getUapTableUrl();
  if (!tableUrl) return 0;

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