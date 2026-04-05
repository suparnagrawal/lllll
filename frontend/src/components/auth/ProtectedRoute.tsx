import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Prevent PENDING_ROLE users from accessing the app
  if (user.role === "PENDING_ROLE") {
    return <Navigate to="/auth/setup" replace />;
  }

  return <Outlet />;
}
