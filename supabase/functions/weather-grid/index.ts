// Weather Grid - Dynamic 7x7 grid sampling
// Sampling atmospheric data around user's location or specified coordinates
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default: Zaragoza center coordinates
const DEFAULT_CENTER = { lat: 41.6561, lon: -0.8773 };
const GRID_SIZE = 7; // 7x7 grid
const GRID_SPREAD = 2.0; // degrees spread in each direction

const KEY = Deno.env.get("OPENWEATHER_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const blocked = guardPublic(req, corsHeaders, 300); // 5 min cache
  if (blocked) return blocked;
  
  if (!KEY) {
    return new Response(JSON.stringify({ error: "OPENWEATHER_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  try {
    // Get center coordinates from request body or use default
    let center = DEFAULT_CENTER;
    
    try {
      const body = await req.json();
      if (body?.lat && body?.lon) {
        center = {
          lat: parseFloat(body.lat),
          lon: parseFloat(body.lon),
        };
      }
    } catch {
      // Body parsing failed, use default
    }
    
    // Generate 7x7 grid coordinates around center
    const grid = [];
    const step = (GRID_SPREAD * 2) / (GRID_SIZE - 1);
    
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const lat = center.lat - GRID_SPREAD + (i * step);
        const lon = center.lon - GRID_SPREAD + (j * step);
        grid.push({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 });
      }
    }
    
    // Fetch weather for all grid points (batch requests with rate limiting)
    const weatherData: any[] = [];
    
    for (const point of grid) {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lon}&appid=${KEY}&units=metric`;
        const response = await fetch(url);
        
        if (!response.ok) {
          weatherData.push(null);
          continue;
        }
        
        const data = await response.json();
        weatherData.push({
          lat: point.lat,
          lon: point.lon,
          temp: data.main?.temp ?? null,
          humidity: data.main?.humidity ?? null,
          pressure: data.main?.pressure ?? null,
          clouds: data.clouds?.all ?? null,
          windSpeed: data.wind?.speed ?? null,
          windDir: data.wind?.deg ?? null,
          weather: data.weather?.[0]?.main ?? null,
          description: data.weather?.[0]?.description ?? null,
          visibility: data.visibility ?? null,
          icon: data.weather?.[0]?.icon ?? null,
          cityName: data.name ?? null,
        });
        
        // Rate limit: wait 50ms between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch {
        weatherData.push(null);
      }
    }
    
    // Filter out failed requests
    const validData = weatherData.filter(Boolean);
    
    // Calculate grid statistics
    const temps = validData.map(d => d.temp).filter((t: number) => t !== null) as number[];
    const humidities = validData.map(d => d.humidity).filter((h: number) => h !== null) as number[];
    const pressures = validData.map(d => d.pressure).filter((p: number) => p !== null) as number[];
    const windSpeeds = validData.map(d => d.windSpeed).filter((w: number) => w !== null) as number[];
    
    const stats = {
      avgTemp: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      avgHumidity: humidities.length ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null,
      avgPressure: pressures.length ? Math.round(pressures.reduce((a, b) => a + b, 0) / pressures.length) : null,
      avgWindSpeed: windSpeeds.length ? Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length * 10) / 10 : null,
      centerTemp: validData[24]?.temp ?? null,
      centerWeather: validData[24]?.weather ?? null,
      centerCity: validData[24]?.cityName ?? null,
    };
    
    return new Response(JSON.stringify({
      gridSize: GRID_SIZE,
      center,
      spread: GRID_SPREAD,
      grid: validData,
      stats,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
    
  } catch (err) {
    console.error("Weather grid error:", err);
    return new Response(JSON.stringify({
      error: "Failed to fetch weather grid",
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
