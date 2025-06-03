import { describe, it, expect } from "vitest";
import {
  createSessionCookie,
  getSession,
  clearSessionCookie,
  type SessionData,
} from "../src/auth/session";

const sample: SessionData = { userId: "123", username: "tester" };

describe("session cookie helpers", () => {
  it("creates and decodes a session cookie", async () => {
    const cookie = createSessionCookie(sample, { maxAge: 100 });
    expect(cookie).toContain("__session=");
    const value = cookie.split("__session=")[1].split(";")[0];
    const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    expect(decoded).toEqual(sample);
    const req = new Request("http://x", { headers: { Cookie: cookie } });
    const result = await getSession(req);
    expect(result).toEqual(sample);
  });

  it("returns null for missing or bad cookie", async () => {
    expect(await getSession(new Request("http://x"))).toBeNull();
    const bad = new Request("http://x", {
      headers: { Cookie: "__session=bad" },
    });
    expect(await getSession(bad)).toBeNull();
  });

  it("returns null for empty cookie value", async () => {
    const emptyCookie = new Request("http://x", {
      headers: { Cookie: "__session=" },
    });
    expect(await getSession(emptyCookie)).toBeNull();
  });

  it("returns null when session cookie not found", async () => {
    const otherCookie = new Request("http://x", {
      headers: { Cookie: "other=value" },
    });
    expect(await getSession(otherCookie)).toBeNull();
  });

  it("creates cookie with custom options", () => {
    const cookie = createSessionCookie(sample, { maxAge: 3600, secure: true });
    expect(cookie).toContain("__session=");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("Secure");
  });

  it("creates cookie with default options", () => {
    const cookie = createSessionCookie(sample);
    expect(cookie).toContain("__session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("handles session data with access token", async () => {
    const sessionWithToken: SessionData = {
      userId: "456",
      username: "tokenuser",
      accessToken: "github_token_123",
    };
    const cookie = createSessionCookie(sessionWithToken);
    const req = new Request("http://x", { headers: { Cookie: cookie } });
    const result = await getSession(req);
    expect(result).toEqual(sessionWithToken);
  });

  it("clears session cookie", () => {
    const cleared = clearSessionCookie();
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("__session=");
  });
});
