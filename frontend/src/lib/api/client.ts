import { API_BASE_URL, AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_USER_KEY } from "./constants";
import type { AuthUser, ApiErrorPayload, RefreshTokenResponse } from "./types";

let onUnauthorizedCallback: (() => void) | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function setAuthSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * Classify error type for better handling
 */
export type ErrorType = "network" | "auth" | "validation" | "server" | "unknown";

export function classifyError(error: unknown): ErrorType {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "network";
  }

  if (error instanceof Error) {
    if (
      error.message.includes("401") ||
      error.message.includes("Session expired") ||
      error.message.includes("Unauthorized")
    ) {
      return "auth";
    }

    if (error.message.includes("400")) {
      return "validation";
    }

    if (error.message.includes("500")) {
      return "server";
    }
  }

  return "unknown";
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearAuth();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 204) {
        return false;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const payload = isJson ? ((await response.json()) as unknown) : null;

      if (!response.ok) {
        clearAuth();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        return false;
      }

      const refreshResponse = payload as RefreshTokenResponse;
      setAuthSession(
        refreshResponse.accessToken,
        refreshResponse.refreshToken,
        refreshResponse.user
      );

      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearAuth();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}


export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    // Auto-logout on 401
    if (response.status === 401) {
      clearAuth();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    const apiPayload = payload as ApiErrorPayload | null;
    const message =
      apiPayload?.error ??
      apiPayload?.message ??
      httpErrorMessage(response.status);
    throw new Error(message);
  }

  return payload as T;
}

export async function requestFormData<T>(
  path: string,
  formData: FormData,
  init?: Omit<RequestInit, "body" | "headers"> & { headers?: HeadersInit }
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: init?.method ?? "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: formData,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    const apiPayload = payload as ApiErrorPayload | null;
    const message =
      apiPayload?.error ??
      apiPayload?.message ??
      httpErrorMessage(response.status);

    throw new Error(message);
  }

  return payload as T;
}

export function httpErrorMessage(status: number): string {
  switch (status) {
    case 400: return "Invalid request";
    case 401: return "Session expired. Please log in again.";
    case 403: return "You don't have permission to perform this action";
    case 404: return "Resource not found";
    case 409: return "Conflict with existing data";
    default:  return `Request failed (${status})`;
  }
}
