import { createClient } from "@libsql/client";

const url = import.meta.env.VITE_TURSO_DATABASE_URL as string | undefined;
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN as string | undefined;

if (!url) {
  throw new Error(
    "VITE_TURSO_DATABASE_URL is missing. Define it in .env[.local]."
  );
}

if (!authToken) {
  throw new Error(
    "VITE_TURSO_AUTH_TOKEN is missing. Define it in .env[.local]."
  );
}

export const turso = createClient({
  url,
  authToken,
});

export default turso;
