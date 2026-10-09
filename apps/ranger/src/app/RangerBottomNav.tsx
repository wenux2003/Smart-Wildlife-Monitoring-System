import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

type NavigationItem = {
  key: "patrol" | "report" | "incidents" | "dispatches";
  label: string;
  to: string;
  icon: React.ReactNode;
};

function PatrolIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2z" />
      <path d="M8.5 4.5v13m7-11v13" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 19 6v5.3c0 4.4-2.8 7.6-7 9.2-4.2-1.6-7-4.8-7-9.2V6z" />
      <path d="M12 8v6m-3-3h6" />
    </svg>
  );
}

function IncidentsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.6 8A7.5 7.5 0 0 0 6 5.7L4 8" />
      <path d="M4 4v4h4m-2.6 8A7.5 7.5 0 0 0 18 18.3l2-2.3" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}

function DispatchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z" />
      <path d="M10 20h4" />
    </svg>
  );
}

export function RangerBottomNav() {
  const { user, loading, captureOnly } = useAuth();
  const { pathname } = useLocation();

  const hiddenRoute =
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname.startsWith("/community/") ||
    pathname.startsWith("/patrol/");

  if (
    loading ||
    !user ||
    user.role !== "RANGER" ||
    user.mustChangePassword ||
    hiddenRoute
  ) {
    return null;
  }

  const activeKey = pathname.startsWith("/incidents/report")
    ? "report"
    : pathname.startsWith("/incidents")
      ? "incidents"
      : pathname.startsWith("/dispatches")
        ? "dispatches"
        : "patrol";

  const items: NavigationItem[] = [
    { key: "patrol", label: "Patrol", to: "/", icon: <PatrolIcon /> },
    {
      key: "report",
      label: "Report",
      to: "/incidents/report",
      icon: <ReportIcon />,
    },
    {
      key: "incidents",
      label: "Incidents",
      to: "/incidents",
      icon: <IncidentsIcon />,
    },
    ...(!captureOnly
      ? [
          {
            key: "dispatches" as const,
            label: "Dispatches",
            to: "/dispatches",
            icon: <DispatchIcon />,
          },
        ]
      : []),
  ];

  return (
    <nav className="ranger-bottom-nav" aria-label="Ranger navigation">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            to={item.to}
            className={active ? "is-active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
