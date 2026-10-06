import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext.js";
import { HomePage } from "../pages/HomePage.js";
import { AuthPage } from "../pages/AuthPage.js";
import { WorkspacePage } from "../pages/WorkspacePage.js";

export function App() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = {
      "/": "Protecting our wild future",
      "/login": "Sign in",
      "/register": "Create an account",
      "/dashboard": "Your workspace",
    };
    document.title = `${titles[location.pathname] ?? "Page not found"} | Wana Rakshaka`;
  }, [location.pathname]);
  return (
    <AuthProvider>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route
          path="/register"
          element={<AuthPage key="register" mode="register" />}
        />
        <Route path="/signup" element={<Navigate to="/register" replace />} />
        <Route path="/dashboard" element={<WorkspacePage />} />
        <Route
          path="*"
          element={
            <main className="center-state" id="main-content">
              <p className="section-kicker">404 / OFF THE TRAIL</p>
              <h1>Let’s find your way back.</h1>
              <Link to="/" className="button button-green">
                Back to home
              </Link>
            </main>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
