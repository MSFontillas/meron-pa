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
  it("picks an icon per product, else the category icon", () => {
    expect(pickIcon("Colgate toothpaste", "Bathroom")).toBe("🪥");
    expect(pickIcon("Mystery item", "Cleaning")).toBe("🧽");
  });
});
