import { usePolledConnector } from "@/lib/connectors";
import { supabase } from "@/integrations/supabase/client";
import type { Flight } from "@/hooks/useAirTraffic";

/**
 * Tráfico aéreo del globo: pasa por la función `air-traffic`.
 *
 * Antes pedía `api.adsb.lol` directamente desde el navegador, y ese host no
 * manda `Access-Control-Allow-Origin`: el navegador bloqueaba la respuesta y
 * la capa de vuelos se quedaba vacía con un error de CORS en consola. La
 * función ya habla con las fuentes (OpenSky / adsb.lol) desde el servidor,
 * donde CORS no aplica, y devuelve exactamente esta forma.
 *
 * `maxAircraft` sigue limitando cuántos vuelos llegan al globo.
 */
export function useAdsbTraffic(enabled: boolean, intervalMs = 15_000, maxAircraft = 300) {
  return usePolledConnector<Flight[]>(
    async () => {
      const { data, error } = await supabase.functions.invoke<{
        flights?: Flight[];
        unavailable?: boolean;
        reason?: string | null;
        mock?: boolean;
      }>("air-traffic", { body: {} });

      if (error) throw new Error(error.message);
      // Un despliegue antiguo contestaba vuelos inventados: se descartan.
      if (data?.mock === true) throw new Error("air-traffic devuelve datos simulados");

      const list = data?.flights ?? [];
      if (!list.length) throw new Error(data?.reason ?? "no aircraft in feed");
      return list.slice(0, maxAircraft);
    },
    [],
    intervalMs,
    enabled,
  );
}
