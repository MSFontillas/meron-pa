import { beforeEach, describe, expect, it } from "vitest";
import { lookupCatalog, resetCatalog } from "./catalog";

const f = (async () => new Response(JSON.stringify({ "4800016644801": ["Piattos Cheese", "Food & drinks", "45 g"], "0036000291452": ["Mine", "Nope", ""] }))) as typeof fetch;
beforeEach(resetCatalog);

describe("lookupCatalog", () => {
  it("finds a barcode and fills the icon", async () => {
    expect(await lookupCatalog("4800016644801", f)).toEqual({ name: "Piattos Cheese", cat: "Food & drinks", icon: "🍪", size: "45 g" });
  });
  it("finds UPC-A under its EAN-13 spelling, unknown kind becomes Other", async () => {
    expect((await lookupCatalog("036000291452", f))?.cat).toBe("Other");
    expect(await lookupCatalog("0036000291452", f)).not.toBeNull();
  });
  it("returns null for unknown codes and when the file is missing", async () => {
    expect(await lookupCatalog("4809999999990", f)).toBeNull();
    resetCatalog();
    expect(await lookupCatalog("4800016644801", (async () => new Response("", { status: 404 })) as typeof fetch)).toBeNull();
  });
});
