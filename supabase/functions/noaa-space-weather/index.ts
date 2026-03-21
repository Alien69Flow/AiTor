const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch Kp index (planetary magnetic index) - JSON endpoint
    const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', {
      headers: { 'Accept': 'application/json' },
    });
    
    // Fetch solar events / NOAA scales
    const scalesRes = await fetch('https://services.swpc.noaa.gov/products/noaa-scales.json', {
      headers: { 'Accept': 'application/json' },
    });

    let kpIndex = 0;
    let kpData: any[] = [];
    if (kpRes.ok) {
      const raw = await kpRes.json();
      // Format: array of arrays, first row is header, last row is most recent
      if (Array.isArray(raw) && raw.length > 1) {
        const latest = raw[raw.length - 1];
        // Index 1 is Kp value
        kpIndex = parseFloat(latest[1]) || 0;
        kpData = raw.slice(-5); // last 5 readings
      }
    }

    let solarStorm = false;
    let stormLevel = "none";
    let radioBlackout = "none";
    let geomagneticStorm = "none";
    let scalesData: any = null;
    
    if (scalesRes.ok) {
      scalesData = await scalesRes.json();
      // NOAA scales JSON has format: { "0": { "DateStamp": "...", "R": {...}, "S": {...}, "G": {...} } }
      if (scalesData && scalesData["0"]) {
        const current = scalesData["0"];
        // R = Radio Blackout, S = Solar Radiation, G = Geomagnetic Storm
        const rScale = current.R?.Scale || "0";
        const sScale = current.S?.Scale || "0";
        const gScale = current.G?.Scale || "0";
        
        radioBlackout = rScale !== "0" ? `R${rScale}` : "none";
        stormLevel = sScale !== "0" ? `S${sScale}` : "none";
        geomagneticStorm = gScale !== "0" ? `G${gScale}` : "none";
        
        solarStorm = parseInt(rScale) >= 1 || parseInt(sScale) >= 1 || parseInt(gScale) >= 1;
      }
    }

    const result = {
      kpIndex,
      kpData,
      solarStorm,
      stormLevel,
      radioBlackout,
      geomagneticStorm,
      timestamp: new Date().toISOString(),
    };

    console.log('NOAA data:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('NOAA fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch NOAA data', kpIndex: 0, solarStorm: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
