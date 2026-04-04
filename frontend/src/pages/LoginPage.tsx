import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";

interface ToastProps {
  type: "error" | "success";
  message: string;
  onDismiss: () => void;
}

function Toast({ type, message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgColor = type === "error" ? "bg-destructive/90" : "bg-green-600/90";
  const textColor = "text-white";

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg ${bgColor} ${textColor} shadow-lg animate-in fade-in slide-in-from-bottom-4 z-50`}
    >
      {message}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  // Check for OAuth error in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasOAuthError = searchParams.get("error") === "oauth_failed";
    
    if (hasOAuthError) {
      const timer = setTimeout(() => {
        setToast({
          type: "error",
          message: "Google sign-in failed. Please try again.",
        });
        // Clean up URL
        window.history.replaceState({}, "", "/login");
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch {
      setToast({
        type: "error",
        message: "Failed to initiate Google sign-in. Please try again.",
      });
      setGoogleLoading(false);
    }
  }, [loginWithGoogle]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">URA System</h1>
          <p className="text-gray-600">Room Availability Management</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Choose your preferred login method
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Google OAuth Section */}
            <div className="space-y-3">
              <Button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                variant="outline"
                className="w-full h-10"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Secure sign-in with your Google account
              </p>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">or</span>
              </div>
            </div>

            {/* Email/Password Section (Coming Soon) */}
            <div className="space-y-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h3 className="text-sm font-medium text-gray-900">
                Email & Password Login
              </h3>
              <p className="text-sm text-gray-600">
                Coming soon. Use Google Sign-in for now.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a href="mailto:admin@example.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact admin
            </a>
          </p>

          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <a href="#" className="hover:text-gray-700">
              Terms of Service
            </a>
            <span>•</span>
            <a href="#" className="hover:text-gray-700">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
