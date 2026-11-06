import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reloadOnceForStaleChunk } from "./lib/lazy-retry";

// Una pestaña abierta pide el chunk que existía cuando se cargó. Tras un
// despliegue ese fichero ya no está, y sin este aviso el import muere con
// «Failed to fetch dynamically imported module»: el módulo entero queda
// inservible hasta que el visitante recarga a mano.
//
// Vite emite `vite:preloadError` para **cualquier** import dinámico, así que
// esto cubre también los que no pasan por `lazyWithRetry` (Cesium, three,
// gráficas) y recarga una sola vez para coger el manifiesto nuevo.
window.addEventListener("vite:preloadError", () => {
  reloadOnceForStaleChunk();
});

createRoot(document.getElementById("root")!).render(<App />);
