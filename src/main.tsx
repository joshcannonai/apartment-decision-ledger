import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { configureSearchClient, createSameOriginSearchClient } from "./domain/store";
import { WebMCPRegistrar } from "./webmcp";
import "./styles.css";
import "./decision-workspace.css";

configureSearchClient(
  import.meta.env.VITE_ENABLE_LIVE_SEARCH === "true"
    ? createSameOriginSearchClient("/api/search")
    : null,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebMCPRegistrar />
    <App />
  </StrictMode>,
);
