import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  rememberCaptureIdentity,
  readCaptureIdentity,
  forgetCaptureIdentity,
} from "./offlineIdentity.js";

export type RangerUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  parkId: string | null;
  parkName: string | null;
  mustChangePassword: boolean;
};

type AuthState = {
  captureOnly: boolean;
  user: RangerUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const OFFLINE_USER_KEY = "wr:ranger:offline-user";

function readOfflineUser(): RangerUser | null {
  try {
    const stored = localStorage.getItem(OFFLINE_USER_KEY);
    return stored ? (JSON.parse(stored) as RangerUser) : null;
  } catch {
    return null;
  }
}

function cacheOfflineUser(user: RangerUser | null) {
  try {
    if (user) localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(OFFLINE_USER_KEY);
  } catch {
    /* Unavailable storage must not interrupt online authentication. */
  }
}

async function request(path: string, body?: object) {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(
      new Error(
        "We couldn’t reach the server. Check your connection and try again.",
      ),
      { status: 0 },
    );
  }
  const data =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.message ?? "The account service is unavailable. Please try again.",
      ),
      { status: response.status },
    );
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RangerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [captureOnly, setCaptureOnly] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const current = (await request("me")).user as RangerUser;
      setUser(current);
      setCaptureOnly(false);
      rememberCaptureIdentity(current);
      cacheOfflineUser(current);
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      if (status === 401 || status === 403) {
        setUser(null);
        setCaptureOnly(false);
        forgetCaptureIdentity();
        cacheOfflineUser(null);
      } else {
        if (!readCaptureIdentity() && status === 0) {
          const cached = readOfflineUser();
          if (cached) rememberCaptureIdentity(cached);
        }
        const remembered = readCaptureIdentity();
        setUser(remembered);
        setCaptureOnly(Boolean(remembered));
        if (!remembered) setError((failure as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (user && !captureOnly) rememberCaptureIdentity(user);
  }, [user, captureOnly]);

  async function signIn(email: string, password: string) {
    const result = await request("login", { email, password });
    setUser(result.user);
    setCaptureOnly(false);
    rememberCaptureIdentity(result.user);
    cacheOfflineUser(result.user);
    setError("");
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const result = await request("change-password", {
      currentPassword,
      newPassword,
    });
    const nextUser = result.user
      ? { ...result.user, mustChangePassword: false }
      : user
        ? { ...user, mustChangePassword: false }
        : null;
    setUser(nextUser);
    cacheOfflineUser(nextUser);
    setCaptureOnly(false);
    if (nextUser) rememberCaptureIdentity(nextUser);
    setError("");
  }

  async function signOut() {
    await request("logout", {});
    setUser(null);
    setCaptureOnly(false);
    forgetCaptureIdentity();
    cacheOfflineUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        captureOnly,
        refresh,
        signIn,
        changePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider required");
  return value;
}
