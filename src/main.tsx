import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./lib/capacitorInit";

initCapacitorPlugins();

createRoot(document.getElementById("root")!).render(<App />);
