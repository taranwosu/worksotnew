import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { AuthProvider } from "./lib/auth-client";
import App from "./App";
import "./index.css";

// Legacy Convex client kept alive so existing `useQuery` calls in not-yet-migrated
// pages (messages, contracts, project workspace) don't throw. They'll simply
// return `undefined` (loading) until those pages are migrated to FastAPI.
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexProvider>
  </React.StrictMode>
);
