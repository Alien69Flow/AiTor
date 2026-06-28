import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Web3Provider } from "./providers/Web3Provider";

createRoot(document.getElementById("root")!).render(
  <Web3Provider>
    <App />
  </Web3Provider>
);
