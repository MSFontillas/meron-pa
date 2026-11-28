import { describe, expect, it } from "vitest";
import { buildCatalog, cleanSize, csvProducts, junkName, parseCsv, validGtin } from "./build-catalog.mjs";

const HEAD = "barcode,name,brand,size,kind,give_back\n";
describe("csv", () => {
  it("handles BOM, quoted commas and quotes, blank lines, CRLF", () => {
    const rows = parseCsv('﻿a,b\r\n\r\n"x, y","say ""hi"""\r\n');
    expect(rows.map((r) => r.cells)).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("reads valid rows", () => {
    const r = csvProducts(HEAD + '4800016644801,"Piattos, Cheese",Jack n Jill,45 g,Food & drinks,yes\n\n');
    expect(r).toEqual([{ code: "4800016644801", name: "Piattos, Cheese", brand: "Jack n Jill", size: "45 g", kind: "Food & drinks", giveBack: true }]);
  });
  it("names the bad line", () => {
    expect(() => csvProducts(HEAD + "4800016644801,A,,,Food & drinks,\n4800016644802,B,,,Food & drinks,\n")).toThrow(/line 3.*check digit/);
    expect(() => csvProducts(HEAD + "4800016644801,,,,Food & drinks,\n")).toThrow(/line 2.*name/);
    expect(() => csvProducts(HEAD + "4800016644801,A,,,Snacks,\n")).toThrow(/line 2.*kind/);
  });
  it("checks GTIN digits", () => {
    expect(validGtin("4800016644801")).toBe(true);
    expect(validGtin("036000291452")).toBe(true);
    expect(validGtin("96385074")).toBe(true);
    expect(validGtin("4800016644800")).toBe(false);
    expect(validGtin("123")).toBe(false);
  });
});

describe("buildCatalog", () => {
  const food = { cat: "Food & drinks", products: { "4800016644801": ["Cheese", "Piattos", "45g", []], "4809999999990": ["Sabon", "", "", ["en:soaps"]] } };
  const beauty = { cat: "Bathroom", products: { "4800016644801": ["Other name", "", "", []] } };
  it("merges: first site wins, brand added, kind guessed", () => {
    const c = buildCatalog([food, beauty], []);
    expect(c["4800016644801"]).toEqual(["Piattos Cheese", "Food & drinks", "45 g"]);
    expect(c["4809999999990"][1]).toBe("Bathroom");
  });
  it("csv beats OFF, even across UPC/EAN spelling", () => {
    const off = { cat: "Food & drinks", products: { "0036000291452": ["Old", "", "", []] } };
    const c = buildCatalog([off], [{ code: "036000291452", name: "Mine", size: "1 L", kind: "Other" }]);
    expect(c).toEqual({ "036000291452": ["Mine", "Other", "1 L"] });
  });
});

describe("crowd-edited junk from Open Food Facts", () => {
  it("drops placeholder and number-only names, keeps real ones", () => {
    expect(junkName("Loading…", "10803769")).toBe(true);
    expect(junkName("4806504710126", "0246540710126")).toBe(true);
    expect(junkName("null aztec secret", "0727616171169")).toBe(true);
    expect(junkName("Piattos Cheese", "4800016644801")).toBe(false);
    expect(junkName("7 Up", "4800016644801")).toBe(false);
  });
  it("keeps sizes that have a unit and blanks bare numbers", () => {
    expect(cleanSize("45 g")).toBe("45 g");
    expect(cleanSize("6 x 55 g")).toBe("6 x 55 g");
    expect(cleanSize("1")).toBe("");
    expect(cleanSize("")).toBe("");
  });
});
