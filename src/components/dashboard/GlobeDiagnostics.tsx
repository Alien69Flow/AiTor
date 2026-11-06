import { useState, useEffect } from "react";
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "";

interface Diagnostics {
  owmKeyConfigured: boolean | null;
  owmTilesWorking: boolean;
  owmLatLonWorking: boolean;
  airTrafficWorking: boolean;
  marineTrafficWorking: boolean;
  layerStats: Record<string, { active: boolean; error?: string }>;
}

export function GlobeDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    const results: Diagnostics = {
      owmKeyConfigured: null,
      owmTilesWorking: false,
      owmLatLonWorking: false,
      airTrafficWorking: false,
      marineTrafficWorking: false,
      layerStats: {},
    };

    // Test OpenWeatherMap tile
    try {
      const tileRes = await fetch(
        `${SUPABASE_URL}/functions/v1/openweather?tile=clouds_new&z=4&x=8&y=5`,
        {
          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );
      if (tileRes.ok) {
        results.owmTilesWorking = true;
      } else {
        const err = await tileRes.json();
        if (err.error?.includes("missing")) {
          results.owmKeyConfigured = false;
        }
      }
    } catch (e) {
      console.error("OWM tile test failed:", e);
    }

    // Test OpenWeatherMap lat/lon
    try {
      const weatherRes = await fetch(
        `${SUPABASE_URL}/functions/v1/openweather?lat=41.6&lon=-0.9`,
        {
          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );
      if (weatherRes.ok) {
        results.owmLatLonWorking = true;
        results.owmKeyConfigured = true;
      } else {
        const err = await weatherRes.json();
        if (err.error?.includes("missing")) {
          results.owmKeyConfigured = false;
        }
      }
    } catch (e) {
      console.error("OWM lat/lon test failed:", e);
    }

    // Test Air Traffic
    try {
      const airRes = await fetch(
        `${SUPABASE_URL}/functions/v1/air-traffic`,
        {
          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );
      if (airRes.ok) {
        const data = await airRes.json();
        results.airTrafficWorking = (data.flights?.length ?? 0) > 0;
      }
    } catch (e) {
      console.error("Air traffic test failed:", e);
    }

    // Test Marine Traffic
    try {
      const marineRes = await fetch(
        `${SUPABASE_URL}/functions/v1/marine-traffic`,
        {
          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );
      if (marineRes.ok) {
        const data = await marineRes.json();
        results.marineTrafficWorking = (data.ships?.length ?? 0) > 0;
      }
    } catch (e) {
      console.error("Marine traffic test failed:", e);
    }

    setDiagnostics(results);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg text-slate-400">
        Running diagnostics...
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-900 rounded-lg space-y-3 text-sm">
      <h3 className="text-cyan-400 font-bold mb-3">🔧 Globe Diagnostics</h3>

      {/* OpenWeatherMap Status */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={
            diagnostics.owmKeyConfigured === true ? "text-emerald-400" :
            diagnostics.owmKeyConfigured === false ? "text-red-400" : "text-amber-400"
          }>
            {diagnostics.owmKeyConfigured === true ? "✅" :
             diagnostics.owmKeyConfigured === false ? "❌" : "⏳"}
          </span>
          <span className="text-slate-300">OpenWeatherMap API Key:</span>
          {diagnostics.owmKeyConfigured === false && (
            <span className="text-red-400 text-xs">
              NOT CONFIGURED - Add OPENWEATHER_API_KEY to Supabase Secrets
            </span>
          )}
          {diagnostics.owmKeyConfigured === true && (
            <span className="text-emerald-400 text-xs">Configured</span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-6">
          <span className={diagnostics.owmTilesWorking ? "text-emerald-400" : "text-slate-500"}>
            {diagnostics.owmTilesWorking ? "✅" : "❌"}
          </span>
          <span className="text-slate-400">Weather Tiles (temperature, clouds, etc)</span>
        </div>

        <div className="flex items-center gap-2 ml-6">
          <span className={diagnostics.owmLatLonWorking ? "text-emerald-400" : "text-slate-500"}>
            {diagnostics.owmLatLonWorking ? "✅" : "❌"}
          </span>
          <span className="text-slate-400">Weather Grid Data</span>
        </div>
      </div>

      {/* Traffic Status */}
      <div className="space-y-1 pt-2 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <span className={diagnostics.airTrafficWorking ? "text-emerald-400" : "text-amber-400"}>
            {diagnostics.airTrafficWorking ? "✅" : "⚠️"}
          </span>
          <span className="text-slate-300">Air Traffic (OpenSky)</span>
          {!diagnostics.airTrafficWorking && (
            <span className="text-slate-500 text-xs">Using mock data</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={diagnostics.marineTrafficWorking ? "text-emerald-400" : "text-amber-400"}>
            {diagnostics.marineTrafficWorking ? "✅" : "⚠️"}
          </span>
          <span className="text-slate-300">Marine Traffic</span>
          {!diagnostics.marineTrafficWorking && (
            <span className="text-slate-500 text-xs">Using mock data (need VesselFinder key)</span>
          )}
        </div>
      </div>

      {/* Instructions */}
      {diagnostics.owmKeyConfigured === false && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
          <p className="text-red-300 font-bold mb-2">⚠️ ACTION REQUIRED</p>
          <ol className="text-slate-300 text-xs space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://openweathermap.org/api" target="_blank" className="text-cyan-400 underline">OpenWeatherMap</a> and get a free API key</li>
            <li>Go to Supabase Dashboard → Settings → Edge Functions → Secrets</li>
            <li>Add secret: <code className="bg-slate-800 px-1 rounded">OPENWEATHER_API_KEY</code> = your_key</li>
            <li>Redeploy edge functions: <code className="bg-slate-800 px-1 rounded">supabase functions deploy</code></li>
            <li>Refresh this page</li>
          </ol>
        </div>
      )}

      <button
        onClick={runDiagnostics}
        className="mt-3 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-xs text-white"
      >
        🔄 Re-run Diagnostics
      </button>
    </div>
  );
}
