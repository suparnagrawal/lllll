const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl
	? configuredApiBaseUrl.replace(/\/$/, "")
	: "/api";
export const AUTH_TOKEN_KEY = "authAccessToken";
export const AUTH_REFRESH_TOKEN_KEY = "authRefreshToken";
export const AUTH_USER_KEY = "authUser";
export const LAST_ACTIVITY_KEY = "lastActivity";
export const REMEMBER_ME_KEY = "rememberMe";
