import { describe, it, expect, beforeEach, vi } from "vitest";
import { mergeRows, type CatalogRow } from "../data/catalogRows";
import { pushRows, checkToken } from "./github";
import { enqueue, queued, flush } from "./outbox";

const row = (code: string, name = "Piattos"): CatalogRow => ({ code, name, brand: "", size: "40 g", kind: "Food & drinks", giveBack: true });
const b64 = (s: string) => btoa(s);
const res = (status: number, json: unknown = {}) => new Response(JSON.stringify(json), { status });

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
});

describe("mergeRows", () => {
  it("replaces the same barcode and appends new ones", () => {
    const a = mergeRows("", [row("4800016644801", "Old")]);
    const b = mergeRows(a, [row("4800016644801", "New"), row("4801234012342", "Corned Beef")]);
    expect(b).toContain("New"); expect(b).not.toContain("Old"); expect(b).toContain("Corned Beef");
  });
  it("refuses a bad barcode", () => { expect(() => mergeRows("", [row("4800016644802")])).toThrow(); });
});

describe("outbox", () => {
  it("keeps rows until sent and replaces by barcode", async () => {
    enqueue(row("4800016644801", "A")); enqueue(row("4800016644801", "B"));
    expect(queued()).toHaveLength(1);
    await expect(flush("t", async () => { throw new Error("offline"); })).rejects.toThrow();
    expect(queued()).toHaveLength(1);
    expect(await flush("t", async () => {})).toBe(1);
    expect(queued()).toHaveLength(0);
  });
});

describe("github client", () => {
  const cur = (text: string) => res(200, { sha: "abc", content: b64(text) });
  it("reads, merges and writes with the sha", async () => {
    const f = vi.fn().mockResolvedValueOnce(cur("")).mockResolvedValueOnce(res(200));
    await pushRows("t", [row("4800016644801")], f as never);
    const put = f.mock.calls[1];
    expect(put[1].method).toBe("PUT");
    const body = JSON.parse(put[1].body);
    expect(body.sha).toBe("abc"); expect(atob(body.content)).toContain("4800016644801");
  });
  it("retries once on a sha conflict, then gives up", async () => {
    const f = vi.fn().mockImplementation(async (_u: string, o?: { method?: string }) => (o?.method === "PUT" ? res(409) : cur("")));
    await expect(pushRows("t", [row("4800016644801")], f as never)).rejects.toThrow();
    expect(f.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(2);
  });
  it("creates the file when it is missing", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(404)).mockResolvedValueOnce(res(201));
    await pushRows("t", [row("4800016644801")], f as never);
    expect(JSON.parse(f.mock.calls[1][1].body).sha).toBeUndefined();
  });
  it("checkToken: bad token, read-only token, good token", async () => {
    expect((await checkToken("t", (async () => res(401)) as never)).ok).toBe(false);
    expect((await checkToken("t", (async () => res(200, { permissions: { push: false } })) as never)).ok).toBe(false);
    expect((await checkToken("t", (async () => res(200, { permissions: { push: true } })) as never)).ok).toBe(true);
  });
});
