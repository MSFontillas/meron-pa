import { describe, expect, it } from "vitest";
import { newHomeId, isHomeId, shareLink, joinIdFromHash, getHomeId } from "./home";

const mem = (): Storage => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
};

describe("home ids and links", () => {
  it("makes unguessable, URL-safe ids", () => {
    const ids = new Set(Array.from({ length: 500 }, newHomeId));
    expect(ids.size).toBe(500);
    for (const id of ids) { expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/); expect(isHomeId(id)).toBe(true); }
  });
  it("keeps the same id on the same phone", () => {
    const s = mem();
    expect(getHomeId(s)).toBe(getHomeId(s));
  });
  it("round-trips a share link and rejects bad ones", () => {
    const id = newHomeId();
    const link = shareLink(id, { origin: "https://x.github.io", pathname: "/grocery-app/" });
    expect(link).toBe(`https://x.github.io/grocery-app/#join=${id}`);
    expect(joinIdFromHash(new URL(link).hash)).toBe(id);
    expect(joinIdFromHash("#join=short")).toBeNull();
    expect(joinIdFromHash("#join=../../etc")).toBeNull();
    expect(joinIdFromHash("")).toBeNull();
  });
});
