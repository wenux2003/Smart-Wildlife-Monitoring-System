import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthContext.js";
import { useAuth } from "../auth/AuthContext.js";
import { WorkspacePage } from "../pages/WorkspacePage.js";
import { AdminPage } from "../pages/AdminPage.js";
import { StaffPage } from "../pages/StaffPage.js";
import { ChangePasswordPage } from "../pages/ChangePasswordPage.js";
import { AccessDeniedPage } from "../pages/AccessDeniedPage.js";
import { OpsShell } from "../components/OpsShell.js";
import { AccountHeader } from "../components/AccountHeader.js";

// Feature pages load on demand so maps and marketing motion stay off the startup path.
const HomePage = lazy(() =>
  import("../pages/HomePage.js").then(({ HomePage: page }) => ({
    default: page,
  })),
);

const AuthPage = lazy(() =>
  import("../pages/AuthPage.js").then(({ AuthPage: page }) => ({
    default: page,
  })),
);

const AlertsPage = lazy(() =>
  import("../pages/AlertsPage.js").then(({ AlertsPage: page }) => ({
    default: page,
  })),
);

const IncidentsPage = lazy(() =>
  import("../pages/IncidentsPage.js").then(({ IncidentsPage: page }) => ({
    default: page,
  })),
);

const IncidentDetailPage = lazy(() =>
  import("../pages/IncidentDetailPage.js").then(
    ({ IncidentDetailPage: page }) => ({ default: page }),
  ),
);

const CameraReviewPage = lazy(() =>
  import("../pages/CameraReviewPage.js").then(({ CameraReviewPage: page }) => ({
    default: page,
  })),
);

const AnalyticsOverviewPage = lazy(() =>
  import("../features/analytics/pages/AnalyticsOverviewPage.js").then(
    ({ AnalyticsOverviewPage: page }) => ({ default: page }),
  ),
);
const AnalyticsMapPage = lazy(() =>
  import("../features/analytics/pages/AnalyticsMapPage.js").then(
    ({ AnalyticsMapPage: page }) => ({ default: page }),
  ),
);
const PatrolGapsPage = lazy(() =>
  import("../features/analytics/pages/PatrolGapsPage.js").then(
    ({ PatrolGapsPage: page }) => ({ default: page }),
  ),
);
const ConflictTrendsPage = lazy(() =>
  import("../features/analytics/pages/ConflictTrendsPage.js").then(
    ({ ConflictTrendsPage: page }) => ({ default: page }),
  ),
);
const ReportHistoryPage = lazy(() =>
  import("../features/analytics/pages/ReportHistoryPage.js").then(
    ({ ReportHistoryPage: page }) => ({ default: page }),
  ),
);

type RoleName =
  "SUPER_ADMIN" | "PARK_MANAGER" | "RANGER" | "LIAISON_OFFICER" | "RESEARCHER";
const homePath = (role: string) =>
  role === "SUPER_ADMIN"
    ? "/admin"
    : role === "RANGER"
      ? "/ranger"
      : "/dashboard";

function RoleHome() {
  const { user, loading, error, refresh } = useAuth();
  if (loading)
    return (
      <main className="center-state" role="status">
        Checking your account…
      </main>
    );
  if (error)
    return (
      <main className="center-state">
        <h1>We couldn’t check your account.</h1>
        <p role="alert">{error}</p>
        <button className="button button-green" onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    );
  return user ? (
    <Navigate
      to={user.mustChangePassword ? "/change-password" : homePath(user.role)}
      replace
    />
  ) : (
    <HomePage />
  );
}

function RoleRoute({
  roles,
  children,
}: {
  roles: readonly RoleName[];
  children: ReactNode;
}) {
  const location = useLocation();
  const { user, loading, error, refresh } = useAuth();
  if (loading)
    return (
      <main className="center-state" role="status">
        Checking your account…
      </main>
    );
  if (error)
    return (
      <main className="center-state">
        <h1>We couldn’t check your account.</h1>
        <p role="alert">{error}</p>
        <button className="button button-green" onClick={() => void refresh()}>
          Try again
        </button>
      </main>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  if (!roles.includes(user.role as RoleName)) {
    if (user.role === "RANGER") return <Navigate to="/ranger" replace />;
    if (location.pathname === "/dashboard" && user.role === "SUPER_ADMIN")
      return <Navigate to="/admin" replace />;
    return <Navigate to="/access-denied" replace />;
  }
  return <OpsShell>{children}</OpsShell>;
}

function AnySignedInRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="center-state" role="status">
        Checking your account…
      </main>
    );
  if (user?.mustChangePassword && location.pathname !== "/change-password")
    return <Navigate to="/change-password" replace />;
  return user ? (
    <OpsShell>{children}</OpsShell>
  ) : (
    <Navigate to="/login" replace />
  );
}

function RangerNoticePage() {
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-panel">
        <p className="section-kicker">RANGER ACCESS</p>
        <h1>Rangers use the Ranger app.</h1>
        <p className="workspace-intro">
          Use the mobile Ranger app to sign in and continue.
        </p>
        <a className="button button-green" href="http://localhost:5173/">
          Open Ranger app
        </a>
      </main>
    </div>
  );
}

export function App() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = {
      "/": "Protecting our wild future",
      "/login": "Sign in",
      "/register": "Create an account",
      "/dashboard": "Your workspace",
      "/admin": "Parks and accounts",
      "/staff": "Staff accounts",
      "/change-password": "Change password",
      "/ranger": "Ranger app access",
      "/analytics": "Conservation analytics",
      "/analytics/map": "Hotspot map",
      "/analytics/patrol-gaps": "Patrol gaps",
      "/analytics/conflicts": "Conflict trends",
      "/reports": "Report history",
    };
    document.title = `${titles[location.pathname] ?? "Page not found"} | Wana Rakshaka`;
  }, [location.pathname]);
  return (
    <AuthProvider>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Suspense
        fallback={
          <main id="main-content" className="center-state" role="status">
            Loading page…
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<RoleHome />} />
          <Route
            path="/login"
            element={<AuthPage key="login" mode="login" />}
          />
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route
            path="/register"
            element={<AuthPage key="register" mode="register" />}
          />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route
            path="/dashboard"
            element={
              <RoleRoute
                roles={["PARK_MANAGER", "LIAISON_OFFICER", "RESEARCHER"]}
              >
                <WorkspacePage />
              </RoleRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleRoute roles={["SUPER_ADMIN"]}>
                <AdminPage />
              </RoleRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <RoleRoute roles={["PARK_MANAGER"]}>
                <StaffPage />
              </RoleRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <RoleRoute roles={["PARK_MANAGER", "LIAISON_OFFICER"]}>
                <AlertsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/incidents"
            element={
              <RoleRoute roles={["PARK_MANAGER", "LIAISON_OFFICER"]}>
                <IncidentsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/incidents/:id"
            element={
              <RoleRoute roles={["PARK_MANAGER", "LIAISON_OFFICER"]}>
                <IncidentDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="/conflicts"
            element={
              <RoleRoute roles={["PARK_MANAGER", "LIAISON_OFFICER"]}>
                <IncidentsPage communityOnly />
              </RoleRoute>
            }
          />
          <Route
            path="/camera-traps"
            element={
              <RoleRoute roles={["PARK_MANAGER", "LIAISON_OFFICER"]}>
                <CameraReviewPage />
              </RoleRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <Suspense
                fallback={
                  <main className="center-state" role="status">
                    Loading analytics…
                  </main>
                }
              >
                <RoleRoute roles={["PARK_MANAGER", "RESEARCHER"]}>
                  <AnalyticsOverviewPage />
                </RoleRoute>
              </Suspense>
            }
          />
          {[
            { path: "/analytics/map", Page: AnalyticsMapPage },
            { path: "/analytics/patrol-gaps", Page: PatrolGapsPage },
            { path: "/analytics/conflicts", Page: ConflictTrendsPage },
            { path: "/reports", Page: ReportHistoryPage },
          ].map(({ path, Page }) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense
                  fallback={
                    <main className="center-state" role="status">
                      Loading analytics…
                    </main>
                  }
                >
                  <RoleRoute roles={["PARK_MANAGER", "RESEARCHER"]}>
                    <Page />
                  </RoleRoute>
                </Suspense>
              }
            />
          ))}
          <Route
            path="/ranger"
            element={
              <RoleRoute roles={["RANGER"]}>
                <RangerNoticePage />
              </RoleRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <AnySignedInRoute>
                <ChangePasswordPage />
              </AnySignedInRoute>
            }
          />
          <Route
            path="/access-denied"
            element={
              <AnySignedInRoute>
                <AccessDeniedPage />
              </AnySignedInRoute>
            }
          />
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
      </Suspense>
    </AuthProvider>
  );
}
