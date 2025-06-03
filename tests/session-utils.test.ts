import { describe, it, expect } from "vitest";
import { createSessionCookie, getSession, clearSessionCookie, type SessionData } from "../src/auth/session";

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
    const bad = new Request("http://x", { headers: { Cookie: "__session=bad" } });
    expect(await getSession(bad)).toBeNull();
  });

  it("clears session cookie", () => {
    const cleared = clearSessionCookie();
    expect(cleared).toContain("Max-Age=0");
  });
});
