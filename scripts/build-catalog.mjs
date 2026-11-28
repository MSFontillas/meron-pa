// Merges the Open Food Facts mirror (data/off/*.json) with the admin's own rows (data/products.csv)
// into public/catalog.json: { "<barcode>": [name, kind, size] }. CSV rows win over OFF.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanName, normalizeSize, CATS, LIMITS } from "../src/data/types.ts";
import { guessCat, codeVariants } from "../src/data/lookup.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
// Order = precedence when two sites know the same barcode (same as the app's lookup).
export const SITES = [
  { file: "openfoodfacts", cat: "Food & drinks" },
  { file: "openbeautyfacts", cat: "Bathroom" },
  { file: "openproductsfacts", cat: "Other" },
  { file: "openpetfoodfacts", cat: "Other" },
];

/** Parses CSV text (BOM, quoted fields with commas/quotes/newlines, blank lines). Returns rows of {line, cells}. */
export function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false, line = 1, start = 1;
  const endRow = () => { row.push(cell); cell = ""; if (row.some((c) => c.trim())) rows.push({ line: start, cells: row }); row = []; start = line + 1; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else { if (c === "\n") line++; cell += c; } }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { endRow(); line++; start = line; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) endRow();
  return rows;
}

/** GTIN check digit (EAN-8, UPC-A, EAN-13). */
export function validGtin(code) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = [...code].map(Number), check = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Turns CSV text into validated rows; throws one Error naming every bad line. */
export function csvProducts(text) {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const cols = head.cells.map((c) => c.trim().toLowerCase());
  const at = (n) => cols.indexOf(n);
  for (const n of ["barcode", "name", "kind"]) if (at(n) < 0) throw new Error(`products.csv: missing column "${n}"`);
  const bad = [], out = [];
  for (const { line, cells } of rows) {
    const get = (n) => (at(n) < 0 ? "" : (cells[at(n)] ?? "").trim());
    const code = get("barcode"), name = get("name"), kind = get("kind"), size = get("size");
    const err = !validGtin(code) ? `barcode "${code}" is not a valid 8, 12 or 13 digit barcode (check digit)`
      : !name || name.length > LIMITS.name ? `name must be 1-${LIMITS.name} characters`
      : !CATS.includes(kind) ? `kind "${kind}" must be one of: ${CATS.join(", ")}`
      : size.length > LIMITS.size ? `size must be at most ${LIMITS.size} characters` : "";
    if (err) bad.push(`products.csv line ${line}: ${err}`);
    else out.push({ code, name, brand: get("brand"), size, kind, giveBack: get("give_back").toLowerCase() === "yes" });
  }
  if (bad.length) throw new Error(bad.join("\n"));
  return out;
}

/** OFF is crowd-edited: skip placeholders ("Loading…"), names that are just digits or "null ...", and sizes with no unit ("1"). */
export const junkName = (n, code) => !n || /loading|^null\b|^undefined\b/i.test(n) || /^[\d\s.-]+$/.test(n) || n.replace(/\D/g, "") === code.replace(/\D/g, "");
export const cleanSize = (s) => { const v = normalizeSize(s ?? ""); return /\d\s*(kg|g|gr|ml|cl|l|oz|pcs?|pack|sachets?|x)\b|\b(pcs?|pack|sachets?)\b/i.test(v) ? v : ""; };

/** mirrors: [{cat, products: { code: [name, brand, quantity, tags] }}] in precedence order. */
export function buildCatalog(mirrors, csv) {
  const cat = {};
  for (const m of mirrors) for (const [code, [nm, brand, qty, tags]] of Object.entries(m.products)) {
    if (codeVariants(code).some((c) => c in cat) || junkName(nm?.trim(), code)) continue;
    const name = cleanName(brand && !nm.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${nm}` : nm);
    if (junkName(name, code)) continue;
    cat[code] = [name, guessCat(m.cat, tags), cleanSize(qty)];
  }
  for (const r of csv) { // admin rows replace OFF, even when OFF spells the barcode with another leading zero
    for (const c of codeVariants(r.code)) delete cat[c];
    cat[r.code] = [cleanName(r.name), r.kind, normalizeSize(r.size)];
  }
  return cat;
}

export const readMirror = (dir) => SITES.map((s) => {
  const f = `${dir}/${s.file}.json`;
  return { cat: s.cat, products: existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {} };
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const csvFile = `${root}data/products.csv`;
  const csv = csvProducts(existsSync(csvFile) ? readFileSync(csvFile, "utf8") : "");
  const cat = buildCatalog(readMirror(`${root}data/off`), csv);
  writeFileSync(`${root}public/catalog.json`, JSON.stringify(cat));
  console.log(`catalog.json: ${Object.keys(cat).length} products (${csv.length} from products.csv)`);
}
