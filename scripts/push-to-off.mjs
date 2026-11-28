// Gives admin rows marked give_back=yes to Open Food Facts when OFF does not know the barcode yet.
// Dry run unless `--send` is passed AND OFF_USER / OFF_PASSWORD are set. Sent codes go to data/sent-to-off.txt.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { csvProducts } from "./build-catalog.mjs";

const d = fileURLToPath(new URL("../data/", import.meta.url));
const UA = "MeronPa/1.0 (https://github.com/MSFontillas/meron-pa)";
const { OFF_USER, OFF_PASSWORD } = process.env;
const live = process.argv.includes("--send") && !!OFF_USER && !!OFF_PASSWORD;
const sentFile = `${d}sent-to-off.txt`;
const sent = new Set(existsSync(sentFile) ? readFileSync(sentFile, "utf8").split(/\s+/) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(live ? "SENDING to Open Food Facts" : "Dry run: nothing is sent (needs --send and OFF_USER, OFF_PASSWORD)");

for (const r of csvProducts(readFileSync(`${d}products.csv`, "utf8")).filter((x) => x.giveBack && !sent.has(x.code))) {
  const known = await fetch(`https://world.openfoodfacts.org/api/v2/product/${r.code}.json?fields=code`, { headers: { "User-Agent": UA } });
  if (known.ok && (await known.json()).status === 1) { console.log(`${r.code}: OFF already has it, skipped`); sent.add(r.code); if (live) appendFileSync(sentFile, r.code + "\n"); continue; }
  const body = new URLSearchParams({ code: r.code, product_name: r.name, brands: r.brand, quantity: r.size, countries: "Philippines", comment: "added via Meron Pa? catalog" });
  if (!live) { console.log(`${r.code}: would POST https://world.openfoodfacts.org/cgi/product_jqm2.pl ${body}`); continue; }
  body.set("user_id", OFF_USER); body.set("password", OFF_PASSWORD);
  const res = await fetch("https://world.openfoodfacts.org/cgi/product_jqm2.pl", { method: "POST", headers: { "User-Agent": UA }, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status !== 1) { console.error(`${r.code}: OFF refused (${res.status} ${j.status_verbose ?? ""})`); process.exitCode = 1; continue; }
  appendFileSync(sentFile, r.code + "\n"); console.log(`${r.code}: sent`);
  await sleep(2_000);
}
