import { API_BASE_URL } from "./constants";
import {
  request,
  setAuthSession,
  clearAuth,
  httpErrorMessage,
} from "./client";
import type { AuthUser, SetupRole, LoginResponse, ApiErrorPayload } from "./types";

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  setAuthSession(response.token, response.user);

  return response.user;
}

export async function startGoogleOAuthLogin(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "GET",
    redirect: "manual",
  });

  if (response.type === "opaqueredirect") {
    window.location.assign(`${API_BASE_URL}/auth/google`);
    return;
  }

  if (response.status >= 300 && response.status < 400) {
    const redirectLocation = response.headers.get("location");

    if (redirectLocation) {
      window.location.assign(redirectLocation);
      return;
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const apiPayload = payload as ApiErrorPayload | null;
    const message =
      apiPayload?.error ??
      apiPayload?.message ??
      httpErrorMessage(response.status);

    throw new Error(message);
  }

  window.location.assign(`${API_BASE_URL}/auth/google`);
}

export async function loginWithOAuthToken(token: string): Promise<AuthUser> {
  localStorage.setItem("authToken", token);

  try {
    const user = await request<AuthUser>("/auth/me");
    localStorage.setItem("authUser", JSON.stringify(user));
    return user;
  } catch (error) {
    clearAuth();
    throw error;
  }
}

export async function completeOAuthSetup(input: {
  setupToken: string;
  role: SetupRole;
  department?: string;
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/complete-setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.setupToken}`,
    },
    body: JSON.stringify({
      role: input.role,
      ...(input.department ? { department: input.department } : {}),
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const apiPayload = payload as ApiErrorPayload | null;
    const message =
      apiPayload?.error ??
      apiPayload?.message ??
      httpErrorMessage(response.status);

    throw new Error(message);
  }

  const loginResponse = payload as LoginResponse;
  setAuthSession(loginResponse.token, loginResponse.user);

  return loginResponse.user;
}
