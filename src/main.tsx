import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./config/appkit";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
