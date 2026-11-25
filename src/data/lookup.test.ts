import { describe, expect, it } from "vitest";
import { codeVariants, lookupBarcode } from "./lookup";
import { normalizeSize, pickIcon } from "./types";

const reply = (host: string, body: object | null) => async (url: string | URL | Request) => {
  const u = String(url);
  if (body && u.startsWith(host)) return new Response(JSON.stringify(body), { status: 200 });
  return new Response("{}", { status: 404 });
};

describe("lookupBarcode", () => {
  it("finds food and adds the brand when the name lacks it", async () => {
    const f = reply("https://world.openfoodfacts.org", { status: 1, product: { product_name: "Corned Beef", brands: "Purefoods", quantity: "150 g" } });
    expect(await lookupBarcode("4801234012342", f as typeof fetch)).toEqual({ name: "Purefoods Corned Beef", cat: "Food & drinks", icon: "🥫", size: "150 g" });
  });
  it("falls through to the household database and guesses the kind", async () => {
    const f = reply("https://world.openproductsfacts.org", { status: 1, product: { product_name: "Fabric conditioner", categories_tags: ["en:fabric-softeners"] } });
    const p = await lookupBarcode("4805678056788", f as typeof fetch);
    expect(p?.cat).toBe("Laundry");
  });
  it("returns null for unknown products, bad codes and network errors", async () => {
    expect(await lookupBarcode("4809012090124", reply("x", null) as typeof fetch)).toBeNull();
    expect(await lookupBarcode("12ab", reply("x", null) as typeof fetch)).toBeNull();
    expect(await lookupBarcode("4809012090124", (async () => { throw new Error("offline"); }) as typeof fetch)).toBeNull();
  });
  it("asks all databases at once: a fast hit wins over a slow miss, and the rest are cancelled", async () => {
    let aborted = 0;
    const f = ((url: string, init?: RequestInit) => new Promise<Response>((res, rej) => {
      init?.signal?.addEventListener("abort", () => { aborted++; rej(new Error("aborted")); });
      const hit = url.includes("openproductsfacts");
      setTimeout(() => res(hit ? new Response(JSON.stringify({ status: 1, product: { product_name: "Bleach" } }))
        : new Response("{}", { status: 404 })), hit ? 50 : 2000);
    })) as typeof fetch;
    const t = performance.now();
    expect((await lookupBarcode("4805678056788", f))?.name).toBe("Bleach");
    expect(performance.now() - t).toBeLessThan(500);
    expect(aborted).toBeGreaterThan(0);
  });
  it("an unknown product takes as long as the slowest database, not the sum; gives up after the time limit", async () => {
    const slow = (ms: number) => (() => new Promise<Response>((res) => setTimeout(() => res(new Response("{}", { status: 404 })), ms))) as unknown as typeof fetch;
    let t = performance.now();
    expect(await lookupBarcode("4809012090124", slow(100))).toBeNull();
    expect(performance.now() - t).toBeLessThan(400); // 4 databases one after another would be 400+
    const hang = ((_u: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as typeof fetch;
    t = performance.now();
    expect(await lookupBarcode("4809012090124", hang, 200)).toBeNull();
    expect(performance.now() - t).toBeLessThan(600);
  });
  it("tries UPC-A and EAN-13 spellings of the same code", () => {
    expect(codeVariants("012345678905")).toEqual(["012345678905", "0012345678905"]);
    expect(codeVariants("0012345678905")).toEqual(["0012345678905", "012345678905"]);
  });
  it("shows one size: grams, then liters, then oz", () => {
    expect(normalizeSize("16.9 fl oz (500 ml)")).toBe("500 ml");
    expect(normalizeSize("1,5 l / 50 oz")).toBe("1.5 L");
    expect(normalizeSize("12 oz (340 g)")).toBe("340 g");
    expect(normalizeSize("6 x 55 g")).toBe("6 x 55 g");
    expect(normalizeSize("12 oz")).toBe("12 oz");
  });
  it("is not slowed down by a hostile 200 KB size string from a crowd-edited database", () => {
    const t = performance.now();
    normalizeSize("1".repeat(200_000));
    expect(performance.now() - t).toBeLessThan(100);
  });
  it("picks an icon per product, else the category icon", () => {
    expect(pickIcon("Colgate toothpaste", "Bathroom")).toBe("🪥");
    expect(pickIcon("Mystery item", "Cleaning")).toBe("🧽");
  });
});

import { toBuy } from "./types";
describe("toBuy", () => {
  it("buys up to the usual amount, at least 1; 0 when no usual amount", () => {
    expect(toBuy({ qty: 2, want: 12 })).toBe(10);
    expect(toBuy({ qty: 12, want: 12 })).toBe(1);
    expect(toBuy({ qty: 0 })).toBe(0);
  });
});
