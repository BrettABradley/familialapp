import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./lib/capacitorInit";
import ErrorBoundary from "./components/shared/ErrorBoundary";

initCapacitorPlugins();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
