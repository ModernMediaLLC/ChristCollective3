import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { disableRuntimeErrorOverlay } from "./lib/disableErrorOverlay";
import { initMetaPixel } from "./lib/metaPixel";

// Disable the error overlay that keeps appearing on page refresh
disableRuntimeErrorOverlay();
initMetaPixel();

createRoot(document.getElementById("root")!).render(<App />);
