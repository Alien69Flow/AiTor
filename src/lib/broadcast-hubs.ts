/** Official destinations only; no claim that a programme is live or embeddable. */
export const BROADCAST_HUBS = [
  { id: "rtve", name: "RTVE 24h", category: "Noticias", url: "https://www.rtve.es/play/24-horas/", availability: "Reproductor oficial" },
  { id: "aljazeera", name: "Al Jazeera English", category: "Noticias", url: "https://www.aljazeera.com/video/live", availability: "Reproductor oficial" },
  { id: "nbc", name: "NBC News NOW", category: "Noticias", url: "https://www.nbcnews.com/now", availability: "Reproductor oficial" },
  { id: "bbc", name: "BBC News", category: "Noticias", url: "https://www.bbc.com/news", availability: "Cobertura oficial · no canal continuo" },
  { id: "bloomberg", name: "Bloomberg TV", category: "Finanzas", url: "https://www.bloomberg.com/live", availability: "Disponibilidad regional" },
  { id: "olympics", name: "Olympics", category: "Deportes", url: "https://www.olympics.com/en/live/", availability: "Según evento y territorio" },
  { id: "f1", name: "F1 TV", category: "Deportes", url: "https://f1tv.formula1.com/", availability: "Suscripción y territorio" },
  { id: "lol", name: "LoL Esports", category: "Gaming / Esports", url: "https://lolesports.com/live", availability: "Según competición" },
  { id: "riot", name: "Riot Games", category: "Gaming / Esports", url: "https://www.twitch.tv/riotgames", availability: "Según competición" },
] as const;