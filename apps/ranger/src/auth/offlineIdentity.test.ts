// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  rememberCaptureIdentity,
  readCaptureIdentity,
  forgetCaptureIdentity,
} from "./offlineIdentity.js";
const user = {
  id: "33333333-3333-4333-8333-333333333333",
  parkId: "11111111-1111-4111-8111-111111111111",
  role: "RANGER",
  name: "Test",
  email: "test@example.org",
  parkName: "Yala",
  mustChangePassword: false,
};
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("offline capture identity", () => {
  it("remembers capture context for seven days, expires it, and clears it on sign-out", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    rememberCaptureIdentity(user);
    expect(readCaptureIdentity()).toEqual(user);
    vi.spyOn(Date, "now").mockReturnValue(now + 8 * 86400000);
    expect(readCaptureIdentity()).toBeNull();
    forgetCaptureIdentity();
    expect(localStorage.length).toBe(0);
  });
  it("does not restore staff roles, temporary passwords, missing parks, corrupt data or invalid IDs", () => {
    for (const change of [
      { role: "RESEARCHER" },
      { parkId: null },
      { mustChangePassword: true },
    ]) {
      rememberCaptureIdentity({ ...user, ...change });
      expect(readCaptureIdentity()).toBeNull();
    }
    rememberCaptureIdentity({ ...user, id: "invalid" });
    expect(readCaptureIdentity()).toBeNull();
    localStorage.setItem("wr-ranger-capture-identity", "corrupt");
    expect(readCaptureIdentity()).toBeNull();
  });
  it("tolerates browser storage being unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(() => rememberCaptureIdentity(user)).not.toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(readCaptureIdentity()).toBeNull();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(() => forgetCaptureIdentity()).not.toThrow();
  });
});
