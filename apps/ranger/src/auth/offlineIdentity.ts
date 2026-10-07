import type { RangerUser } from "./AuthContext.js";
const key = "wr-ranger-capture-identity";
export function rememberCaptureIdentity(user: RangerUser) {
  try {
    if (user.role === "RANGER" && user.parkId && !user.mustChangePassword)
      localStorage.setItem(key, JSON.stringify({ user, savedAt: Date.now() }));
    else forgetCaptureIdentity();
  } catch {
    /* Capture remains available in the current session. */
  }
}
export function forgetCaptureIdentity() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled. */
  }
}
export function readCaptureIdentity(): RangerUser | null {
  try {
    const { user, savedAt } =
      JSON.parse(localStorage.getItem(key) ?? "null") ?? {};
    const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
    return user?.role === "RANGER" &&
      !user.mustChangePassword &&
      uuid.test(user.id) &&
      uuid.test(user.parkId) &&
      Date.now() - savedAt < 7 * 86400000
      ? user
      : null;
  } catch {
    return null;
  }
}
