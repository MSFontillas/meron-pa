// Merges the Open Food Facts mirror (data/off/*.json) with the admin's own rows (data/products.csv)
// into public/catalog.json: { "<barcode>": [name, kind, size] }. CSV rows win over OFF.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanName, normalizeSize } from "../src/data/types.ts";
import { guessCat, codeVariants } from "../src/data/lookup.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
// Order = precedence when two sites know the same barcode (same as the app's lookup).
export const SITES = [
  { file: "openfoodfacts", cat: "Food & drinks" },
  { file: "openbeautyfacts", cat: "Bathroom" },
  { file: "openproductsfacts", cat: "Other" },
  { file: "openpetfoodfacts", cat: "Other" },
];

export { parseCsv, validGtin, csvProducts } from "../src/data/catalogRows.ts";
import { csvProducts } from "../src/data/catalogRows.ts";

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
