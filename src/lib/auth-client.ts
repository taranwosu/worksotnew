/**
 * Better Auth Client for React
 * Shipper auth template version: convex-better-auth-0.10.10+better-auth-1.4.9
 * @see https://convex-better-auth.netlify.app/
 */
import { createAuthClient } from "better-auth/react";
import { anonymousClient, genericOAuthClient } from "better-auth/client/plugins";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { AUTH_CONFIG } from "../../shipper.auth";

/**
 * Better Auth client instance
 * Use only for provider wiring in main.tsx.
 * App UI should use the helper functions below instead of calling authClient directly.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    crossDomainClient(),
    genericOAuthClient(),
    anonymousClient(),
  ],
});

export { AUTH_CONFIG };
export const { useSession } = authClient;

/**
 * Error code type from Better Auth
 * Use authClient.$ERROR_CODES for the full list of error codes
 */
export type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

/**
 * Authentication error type with typed error codes
 */
export interface AuthError {
  message: string;
  code?: AuthErrorCode | string;
}

/**
 * Map of error codes to user-friendly messages
 * Extend this object to add custom translations
 */
const errorMessages: Partial<Record<AuthErrorCode | string, string>> = {
  USER_NOT_FOUND: "No account found with this email",
  INVALID_PASSWORD: "Invalid password",
  USER_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_EMAIL: "Please enter a valid email address",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  PASSWORD_TOO_LONG: "Password is too long",
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later",
};

/**
 * Get a user-friendly error message from an error code
 */
export function getErrorMessage(code: string | undefined): string {
  if (!code) return "An unexpected error occurred";
  return errorMessages[code] ?? code.replace(/_/g, " ").toLowerCase();
}

/**
 * Parse error from Better Auth response
 */
function parseAuthError(error: unknown): AuthError {
  if (error && typeof error === "object") {
    const err = error as { code?: string; message?: string };
    return {
      message: err.message ?? getErrorMessage(err.code),
      code: err.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred" };
}

// ============================================================================
// SIGN IN / SIGN UP HELPERS
// ============================================================================

export interface SignInResult {
  success: boolean;
  error?: AuthError;
}

function getDefaultCallbackURL(): string {
  return typeof window !== "undefined"
    ? new URL("/", window.location.origin).toString()
    : "/";
}

function normalizeLocalPath(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  if (typeof window === "undefined") return fallback;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sign in with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.emailPasswordEnabled) {
    return {
      success: false,
      error: { message: "Email/password sign-in is disabled" },
    };
  }

  const { error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: getDefaultCallbackURL(),
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign up with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.emailPasswordEnabled) {
    return {
      success: false,
      error: { message: "Email/password sign-up is disabled" },
    };
  }
  if (!AUTH_CONFIG.signupEnabled) {
    return {
      success: false,
      error: { message: "Signups are disabled" },
    };
  }

  const { error } = await authClient.signUp.email({
    email,
    password,
    name: name ?? "",
    callbackURL: getDefaultCallbackURL(),
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign in with Shipper-managed Google OAuth
 */
export async function signInWithGoogle(callbackURL?: string): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.googleEnabled) {
    return {
      success: false,
      error: { message: "Google sign-in is disabled" },
    };
  }

  const redirectURL =
    typeof window !== "undefined"
      ? new URL(normalizeLocalPath(callbackURL, "/"), window.location.origin).toString()
      : callbackURL ?? "/";

  const { error } = await authClient.signIn.oauth2({
    providerId: "shipper-google",
    callbackURL: redirectURL,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign in anonymously for guest access
 */
export async function signInAnonymously(): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.anonymousEnabled) {
    return {
      success: false,
      error: { message: "Anonymous access is disabled" },
    };
  }
  if (!AUTH_CONFIG.signupEnabled) {
    return {
      success: false,
      error: { message: "Anonymous access is disabled when signups are disabled" },
    };
  }

  const { error } = await authClient.signIn.anonymous();

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<SignInResult> {
  const { error } = await authClient.signOut();

  if (error) {
    return {
      success: false,
      error: parseAuthError(error),
    };
  }

  return { success: true };
}
