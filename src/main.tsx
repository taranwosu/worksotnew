import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./lib/auth-client";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./index.css";

void initSentry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
