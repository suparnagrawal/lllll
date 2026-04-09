import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";

type CallbackState = "loading" | "error" | "success";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithToken, user } = useAuth();
  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (user) {
      navigate("/");
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const error = searchParams.get("error");
    const authProvider = searchParams.get("authProvider");
    const setupToken = searchParams.get("token");

    if (error === "oauth_failed") {
      setState("error");
      setErrorMessage("Google sign-in failed. Please try again.");
      return;
    }

    if (!accessToken) {
      setState("error");
      setErrorMessage("Missing OAuth token. Please try signing in again.");
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        setState("loading");
        setErrorMessage("");
        
        // Store tokens and fetch user info
        localStorage.setItem("authAccessToken", accessToken);
        if (refreshToken) {
          localStorage.setItem("authRefreshToken", refreshToken);
        }

        // Use loginWithToken to fetch user data
        await loginWithToken(accessToken);

        if (isCancelled) {
          return;
        }

        setState("success");
        // Small delay to show success state before redirect
        setTimeout(() => {
          if (!isCancelled) {
            // Redirect to setup only when backend explicitly provides a setup token.
            if (setupToken) {
              const encodedToken = encodeURIComponent(setupToken);
              const setupUrl = authProvider
                ? `/auth/setup?token=${encodedToken}&authProvider=${encodeURIComponent(authProvider)}`
                : `/auth/setup?token=${encodedToken}`;
              navigate(setupUrl);
              return;
            }

            navigate("/");
          }
        }, 500);
      } catch (err) {
        if (isCancelled) {
          return;
        }

        setState("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Authentication failed. Please try again."
        );
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, loginWithToken, navigate]);

  if (state === "error") {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Authentication Failed
          </h1>

          <p className="text-center text-slate-600 mb-6">{errorMessage}</p>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/login")}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </button>

            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-4">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Sign In Successful
          </h1>

          <p className="text-slate-600">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-100 p-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          Completing Sign In
        </h1>

        <p className="text-center text-slate-600 mb-8">
          Please wait while we verify your credentials...
        </p>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
            <span className="text-sm text-slate-600">Verifying authentication</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-slate-300"></div>
            <span className="text-sm text-slate-600">Setting up your session</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-slate-300"></div>
            <span className="text-sm text-slate-600">Redirecting you</span>
          </div>
        </div>
      </div>
    </div>
  );
}
