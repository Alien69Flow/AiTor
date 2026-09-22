import { loadBackendConfig } from "../../config/env.js";

export interface EdgeFunctionRequest {
  readonly name: string;
  readonly body?: unknown;
  /** Supabase user JWT. Do not confuse this with the publishable key. */
  readonly accessToken?: string;
  /** Only use for trusted server jobs, never accept this from a client. */
  readonly useServiceRole?: boolean;
}

export interface EdgeFunctionResponse<T = unknown> {
  readonly data?: T;
  readonly error?: string;
  readonly status: number;
}

export class SupabaseEdgeFunctionClient {
  private readonly config = loadBackendConfig();

  async invoke<T = unknown>(request: EdgeFunctionRequest): Promise<EdgeFunctionResponse<T>> {
    const token = request.useServiceRole
      ? this.config.supabaseServiceRoleKey
      : request.accessToken;

    if (request.useServiceRole && !token) {
      return { status: 500, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" };
    }
    if (!request.useServiceRole && !token) {
      return { status: 401, error: "A verified Supabase access token is required" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: this.config.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await fetch(`${this.config.supabaseUrl}/functions/v1/${request.name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(request.body ?? {}),
      });
      const text = await response.text();
      let data: unknown = undefined;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = text;
      }
      if (!response.ok) {
        return { status: response.status, error: this.errorMessage(data, response.status) };
      }
      return { status: response.status, data: data as T };
    } catch (error) {
      return {
        status: 502,
        error: error instanceof Error ? error.message : "Supabase Edge Function request failed",
      };
    }
  }

  private errorMessage(data: unknown, status: number): string {
    if (typeof data === "object" && data !== null && "error" in data) {
      const error = (data as { error?: unknown }).error;
      if (typeof error === "string") return error;
    }
    return `Supabase Edge Function failed with HTTP ${status}`;
  }
}
