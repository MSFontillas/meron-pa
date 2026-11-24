import { describe, expect, it } from "vitest";
import { lookupBarcode } from "./lookup";

const reply = (host: string, body: object | null) => async (url: string | URL | Request) => {
  const u = String(url);
  if (body && u.startsWith(host)) return new Response(JSON.stringify(body), { status: 200 });
  return new Response("{}", { status: 404 });
};

describe("lookupBarcode", () => {
  it("finds food and adds the brand when the name lacks it", async () => {
    const f = reply("https://world.openfoodfacts.org", { status: 1, product: { product_name: "Corned Beef", brands: "Purefoods", quantity: "150 g" } });
    expect(await lookupBarcode("4801234012342", f as typeof fetch)).toEqual({ name: "Purefoods Corned Beef", cat: "Food & drinks", icon: "🍚", size: "150 g" });
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
});
