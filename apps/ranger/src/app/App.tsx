import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext.js";
import { RangerHomePage } from "../HomePage.js";
import { ChangePasswordPage, LoadingState } from "../pages/ChangePasswordPage.js";
import { LoginPage } from "../pages/LoginPage.js";

function ProtectedHome() {
  const { user, loading, signOut } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "RANGER")
    return (
      <main className="auth-screen" id="main-content">
        <section className="auth-card" aria-labelledby="access-title">
          <p className="eyebrow">RANGER ACCESS</p>
          <h1 id="access-title">This app is for rangers.</h1>
          <p className="lead">Sign out and use the app provided for your role.</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <RangerHomePage />;
}

function RangerRoutes() {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Patrol",
      "/login": "Ranger sign in",
      "/change-password": "Change password",
    };
    document.title = `${titles[location.pathname] ?? "Ranger access"} | Wildlife Guardian`;
  }, [location.pathname]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<ProtectedHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RangerRoutes />
    </AuthProvider>
  );
}
