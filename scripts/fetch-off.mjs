// Mirrors the Open Food Facts family products sold in the Philippines into data/off/<site>.json.
// Reads the sites' daily CSV exports (one download each, no API hammering): the search API stops at
// 1000 results per query (page 11 answers 503), too few for the ~9,500 Philippine food products.
// Sends an identifying User-Agent (no personal details).
import { writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../data/off/", import.meta.url));
const UA = "MeronPa/1.0 (https://github.com/MSFontillas/meron-pa)";
const SITES = ["openfoodfacts", "openbeautyfacts", "openproductsfacts", "openpetfoodfacts"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Streams one export (tab separated, gzip) and keeps rows whose countries_tags include the Philippines. */
async function mirror(site) {
  const res = await fetch(`https://static.${site}.org/data/en.${site}.org.products.csv.gz`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${site}: HTTP ${res.status}`);
  const lines = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
  const products = {};
  let col = null;
  for await (const line of lines) {
    const cells = line.split("\t");
    if (!col) { col = Object.fromEntries(cells.map((c, i) => [c, i])); continue; }
    if (!cells[col.countries_tags]?.split(",").includes("en:philippines")) continue;
    const code = cells[col.code], name = (cells[col.product_name] || "").trim();
    if (!/^\d{8,14}$/.test(code ?? "") || !name) continue;
    products[code] = [name, (cells[col.brands] ?? "").split(",")[0].trim(), (cells[col.quantity] ?? "").trim(), (cells[col.categories_tags] ?? "").split(",").filter(Boolean).slice(0, 12)];
  }
  if (!col) throw new Error(`${site}: empty export`);
  return products;
}

mkdirSync(out, { recursive: true });
for (const site of SITES) {
  let products;
  for (let tries = 1; !products; tries++) {
    try { products = await mirror(site); }
    catch (e) { if (tries >= 3) { console.error(e.message); process.exit(1); } await sleep(30_000 * tries); }
  }
  const keys = Object.keys(products).sort();
  // One product per line keeps weekly commits readable. Written only after the whole site succeeded.
  writeFileSync(`${out}${site}.json`, `{\n${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(products[k])}`).join(",\n")}\n}\n`);
  console.log(`${site}: ${keys.length} products`);
}
