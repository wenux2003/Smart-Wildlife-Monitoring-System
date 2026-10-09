import { createContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BellRing,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileClock,
  Footprints,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  ShieldCheck,
  Trees,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext.js";
import "./OpsShell.css";

export const OpsShellContext = createContext(false);

type NavigationItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: string[];
};
const managers = ["PARK_MANAGER"];
const operations = ["PARK_MANAGER", "LIAISON_OFFICER"];
const analysts = ["PARK_MANAGER", "RESEARCHER"];
const groups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "WORKSPACE",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: [...operations, "RESEARCHER"],
      },
      {
        label: "Incidents",
        path: "/incidents",
        icon: TriangleAlert,
        roles: operations,
      },
      {
        label: "Community inbox",
        path: "/conflicts",
        icon: MessageSquare,
        roles: operations,
      },
      {
        label: "Camera review",
        path: "/camera-traps",
        icon: Camera,
        roles: operations,
      },
      {
        label: "Wildlife alerts",
        path: "/alerts",
        icon: BellRing,
        roles: operations,
      },
    ],
  },
  {
    label: "ANALYTICS & REPORTS",
    items: [
      {
        label: "Overview",
        path: "/analytics",
        icon: BarChart3,
        roles: analysts,
      },
      {
        label: "Hotspot map",
        path: "/analytics/map",
        icon: Map,
        roles: analysts,
      },
      {
        label: "Patrol gaps",
        path: "/analytics/patrol-gaps",
        icon: Footprints,
        roles: analysts,
      },
      {
        label: "Conflict trends",
        path: "/analytics/conflicts",
        icon: Trees,
        roles: analysts,
      },
      {
        label: "Report history",
        path: "/reports",
        icon: FileClock,
        roles: analysts,
      },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { label: "Staff accounts", path: "/staff", icon: Users, roles: managers },
      {
        label: "Parks & accounts",
        path: "/admin",
        icon: ShieldCheck,
        roles: ["SUPER_ADMIN"],
      },
      {
        label: "Ranger app",
        path: "/ranger",
        icon: Footprints,
        roles: ["RANGER"],
      },
    ],
  },
];

function savedCollapsed() {
  try {
    return localStorage.getItem("wr.sidebar.collapsed") === "true";
  } catch {
    return false;
  }
}

export function OpsShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(savedCollapsed);
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.("(max-width: 900px)").matches ?? false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.roles.includes(user?.role ?? ""),
      ),
    }))
    .filter((group) => group.items.length);
  const active = (path: string) =>
    location.pathname === path ||
    (path === "/incidents" && location.pathname.startsWith("/incidents/"));
  const current = visibleGroups
    .flatMap((group) => group.items)
    .find((item) => active(item.path));

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (!media) return;
    const changed = () => {
      setMobile(media.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!mobile || !mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    surfaceRef.current?.setAttribute("inert", "");
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      surfaceRef.current?.removeAttribute("inert");
    };
  }, [mobile, mobileOpen]);

  function closeMenu() {
    setMobileOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  }
  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem("wr.sidebar.collapsed", String(!value));
      } catch {
        /* Optional preference storage. */
      }
      return !value;
    });
  }
  function navigationSearch(path: string) {
    if (!(path.startsWith("/analytics") || path === "/reports")) return "";
    if (!(
      location.pathname.startsWith("/analytics") ||
      location.pathname === "/reports"
    ))
      return "";
    const params = new URLSearchParams(location.search);
    if (path !== "/reports")
      for (const key of ["status", "page", "historyFrom", "historyTo"])
        params.delete(key);
    return params.toString();
  }
  async function logout() {
    setPending(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign out failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <OpsShellContext.Provider value={true}>
      <div
        className={`ops-shell${collapsed && !mobile ? " is-collapsed" : ""}`}
      >
        {mobile && mobileOpen && (
          <button
            type="button"
            className="ops-menu-shade"
            aria-label="Close navigation backdrop"
            tabIndex={-1}
            onClick={closeMenu}
          />
        )}
        <aside
          ref={sidebarRef}
          id="ops-navigation"
          className="ops-sidebar"
          hidden={mobile && !mobileOpen}
          role={mobile && mobileOpen ? "dialog" : undefined}
          aria-modal={mobile && mobileOpen ? true : undefined}
          aria-label="Workspace navigation"
          onKeyDown={(event) => {
            if (!mobile || !mobileOpen) return;
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
            }
            if (event.key !== "Tab") return;
            const controls = sidebarRef.current?.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled])",
            );
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="ops-sidebar-brand">
            <Link
              to={
                user?.role === "SUPER_ADMIN"
                  ? "/admin"
                  : user?.role === "RANGER"
                    ? "/ranger"
                    : "/dashboard"
              }
              aria-label="Wana Rakshaka workspace"
              onClick={() => mobile && closeMenu()}
            >
              <span className="ops-brand-symbol">
                <Leaf size={28} strokeWidth={1.8} />
              </span>
              <span className="ops-brand-copy">
                <strong>
                  Wana Rakshaka<span>.</span>
                </strong>
                <small>WILDLIFE GUARDIAN</small>
              </span>
            </Link>
            {mobile ? (
              <button
                ref={closeRef}
                type="button"
                className="ops-icon-button ops-mobile-close"
                aria-label="Close navigation"
                onClick={closeMenu}
              >
                <X size={20} />
              </button>
            ) : (
              <button
                type="button"
                className="ops-sidebar-collapse"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                aria-controls="ops-navigation"
              >
                {collapsed ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronLeft size={16} />
                )}
              </button>
            )}
          </div>
          <nav className="ops-sidebar-nav" aria-label="Main navigation">
            {visibleGroups.map((group) => (
              <div className="ops-nav-group" key={group.label}>
                <p className="ops-nav-group-label">{group.label}</p>
                {group.items.map(({ label, path, icon: Icon }) => (
                  <Link
                    key={path}
                    to={{ pathname: path, search: navigationSearch(path) }}
                    aria-current={active(path) ? "page" : undefined}
                    title={collapsed && !mobile ? label : undefined}
                    className="ops-nav-link"
                    onClick={() => mobile && closeMenu()}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span className="ops-nav-label">{label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="ops-sidebar-account">
            <div className="ops-account-row">
              <span className="ops-avatar" aria-hidden="true">
                {user?.name
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="ops-account-copy">
                <strong>{user?.name}</strong>
                <span>{user?.role.replaceAll("_", " ").toLowerCase()}</span>
                <small>{user?.email}</small>
              </div>
            </div>
            <button
              type="button"
              className="ops-sign-out"
              title={collapsed && !mobile ? "Sign out" : undefined}
              disabled={pending}
              onClick={() => void logout()}
              aria-label={pending ? "Signing out…" : "Sign out"}
            >
              <LogOut size={18} aria-hidden="true" />
              <span className="ops-nav-label">
                {pending ? "Signing out…" : "Sign out"}
              </span>
            </button>
            {error && (
              <p role="alert" className="ops-sign-out-error">
                {error}
              </p>
            )}
          </div>
        </aside>
        <div className="ops-surface" ref={surfaceRef}>
          <header className="ops-topbar">
            <div className="ops-topbar-location">
              {mobile && (
                <button
                  ref={menuRef}
                  type="button"
                  className="ops-icon-button"
                  aria-label="Open navigation"
                  aria-expanded={mobileOpen}
                  aria-controls="ops-navigation"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu size={22} />
                </button>
              )}
              <span className="ops-workspace-name">Conservation workspace</span>
              <ChevronRight size={14} aria-hidden="true" />
              <span className="ops-current-page">
                {current?.label ?? "Account"}
              </span>
            </div>
            <div className="ops-park-badge">
              <Trees size={16} aria-hidden="true" />
              <span>
                {user?.parkName ??
                  (user?.role === "SUPER_ADMIN"
                    ? "National administration"
                    : "Park access pending")}
              </span>
            </div>
          </header>
          <div className="ops-content">{children}</div>
          <footer className="ops-workspace-footer">
            <Leaf size={13} aria-hidden="true" /> Protecting our wild future,
            together.
          </footer>
        </div>
      </div>
    </OpsShellContext.Provider>
  );
}
