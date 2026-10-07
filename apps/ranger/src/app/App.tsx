import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext.js";
import { RangerHomePage } from "../HomePage.js";
import { ChangePasswordPage, LoadingState } from "../pages/ChangePasswordPage.js";
import { LoginPage } from "../pages/LoginPage.js";
import { PatrolMapPage } from "../pages/PatrolMapPage.js";
import { NewWaypointPage } from "../pages/NewWaypointPage.js";
import { DispatchesPage } from "../pages/DispatchesPage.js";

function ProtectedRanger({ children }: { children: React.ReactNode }) {
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
  return children;
}

function RangerRoutes() {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Patrol",
      "/login": "Ranger sign in",
      "/change-password": "Change password",
      ...(location.pathname.startsWith("/patrol/") ? { [location.pathname]: "Active patrol" } : {}),
    };
    document.title = `${titles[location.pathname] ?? "Ranger access"} | Wildlife Guardian`;
  }, [location.pathname]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<ProtectedRanger><RangerHomePage /></ProtectedRanger>} />
        <Route
          path="/patrol/:assignmentId/active"
          element={<ProtectedRanger><PatrolMapPage /></ProtectedRanger>}
        />
        <Route
          path="/patrol/:assignmentId/waypoints/new"
          element={<ProtectedRanger><NewWaypointPage /></ProtectedRanger>}
        />
        <Route path="/dispatches" element={<ProtectedRanger><DispatchesPage /></ProtectedRanger>} />
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
