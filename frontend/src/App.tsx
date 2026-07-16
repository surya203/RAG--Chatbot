import { Navigate, Route, Routes } from "react-router-dom";

import AdminRoute from "@/components/AdminRoute";
import ProtectedRoute from "@/components/ProtectedRoute";
import StudentRoute from "@/components/StudentRoute";
import { useAuth } from "@/context/AuthContext";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import ChatPage from "@/pages/ChatPage";
import DashboardPage from "@/pages/DashboardPage";
import ExamProfilePage from "@/pages/ExamProfilePage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ListeningCoachPage from "@/pages/ListeningCoachPage";
import LoginPage from "@/pages/LoginPage";
import MockExamPage from "@/pages/MockExamPage";
import ProgressPage from "@/pages/ProgressPage";
import ReadingCoachPage from "@/pages/ReadingCoachPage";
import RegisterPage from "@/pages/RegisterPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SpeakingCoachPage from "@/pages/SpeakingCoachPage";
import VocabCoachPage from "@/pages/VocabCoachPage";
import WritingCoachPage from "@/pages/WritingCoachPage";

function homeForRole(role?: string) {
  return role === "admin" ? "/admin" : "/dashboard";
}

export default function AppRoutes() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-muted-foreground)]">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={homeForRole(user?.role)} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to={homeForRole(user?.role)} replace />
          ) : (
            <RegisterPage />
          )
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      <Route element={<StudentRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/exam-profile" element={<ExamProfilePage />} />
        <Route path="/writing" element={<WritingCoachPage />} />
        <Route path="/speaking" element={<SpeakingCoachPage />} />
        <Route path="/reading" element={<ReadingCoachPage />} />
        <Route path="/listening" element={<ListeningCoachPage />} />
        <Route path="/vocab" element={<VocabCoachPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/mocks" element={<MockExamPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={<Navigate to={homeForRole(user?.role)} replace />}
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? homeForRole(user?.role) : "/login"} replace />
        }
      />
    </Routes>
  );
}
