import { Navigate } from "react-router-dom";

import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/context/AuthContext";

/** Student-only routes (admins are sent to the admin dashboard). */
export default function StudentRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-muted-foreground)]">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <StudentLayout />;
}
