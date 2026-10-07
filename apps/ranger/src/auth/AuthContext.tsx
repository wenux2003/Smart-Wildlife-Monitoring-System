import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

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
  user: RangerUser | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const OFFLINE_USER_KEY = "wr:ranger:offline-user";

function readOfflineUser(): RangerUser | null {
  try {
    const stored = localStorage.getItem(OFFLINE_USER_KEY);
    return stored ? JSON.parse(stored) as RangerUser : null;
  } catch {
    return null;
  }
}

function cacheOfflineUser(user: RangerUser | null) {
  if (user) localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(OFFLINE_USER_KEY);
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
      new Error("We couldn’t reach the server. Check your connection and try again."),
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const currentUser = (await request("me")).user as RangerUser;
      setUser(currentUser);
      cacheOfflineUser(currentUser);
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      const cachedUser = status === 0 ? readOfflineUser() : null;
      setUser(cachedUser);
      if (status === 401) cacheOfflineUser(null);
      if (status !== 401)
        setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function signIn(email: string, password: string) {
    const result = await request("login", { email, password });
    setUser(result.user);
    cacheOfflineUser(result.user);
    setError("");
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
  ) {
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
    setError("");
  }

  async function signOut() {
    await request("logout", {});
    setUser(null);
    cacheOfflineUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, signIn, changePassword, signOut }}
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
