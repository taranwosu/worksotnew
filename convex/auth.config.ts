/**
 * Better Auth Provider Configuration
 * Shipper auth template version: convex-better-auth-0.10.10+better-auth-1.4.9
 * @see https://convex-better-auth.netlify.app/
 */
import type { AuthConfig } from "convex/server";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

export default {
  providers: [
    getAuthConfigProvider(),
  ],
} satisfies AuthConfig;
