import { cleanName, normalizeSize, pickIcon, type Cat, type Product } from "./types.ts";

// Free public product databases (Open Food Facts family). First match wins.
const SOURCES: { host: string; cat: Cat }[] = [
  { host: "https://world.openfoodfacts.org", cat: "Food & drinks" },
  { host: "https://world.openbeautyfacts.org", cat: "Bathroom" },
  { host: "https://world.openproductsfacts.org", cat: "Other" },
  { host: "https://world.openpetfoodfacts.org", cat: "Other" },
];

// Scanners and databases disagree on leading zeros (UPC-A 12 digits vs EAN-13 13 digits): try each spelling.
export function codeVariants(code: string): string[] {
  const v = new Set([code]);
  if (code.length === 12) v.add("0" + code);
  if (code.length === 13 && code[0] === "0") v.add(code.slice(1));
  return [...v];
}

export const isBarcode = (code: string) => /^[0-9]{8,14}$/.test(code);

export function guessCat(base: Cat, tags: unknown): Cat {
  const t = Array.isArray(tags) ? tags.join(" ") : "";
  if (/laundry|detergent|fabric-softener/.test(t)) return "Laundry";
  if (/diaper|nappies|baby-wipes|infant-formula/.test(t)) return "Baby";
  if (/cleaning|dishwashing|bleach|disinfectant|toilet-cleaner/.test(t)) return "Cleaning";
  if (/shampoo|soap|toothpaste|toilet-paper|deodorant/.test(t)) return "Bathroom";
  return base;
}

function parse(j: unknown, base: Cat): Product | null {
  const o = j as { status?: number; product?: Record<string, unknown> } | null;
  const p = o?.product;
  const raw = typeof p?.product_name === "string" && p.product_name.trim() ? p.product_name
    : typeof p?.product_name_en === "string" ? p.product_name_en : "";
  if (o?.status !== 1 || !p || !raw.trim()) return null;
  const brand = typeof p.brands === "string" ? p.brands.split(",")[0].trim() : "";
  const name = cleanName(brand && !raw.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${raw}` : raw);
  const cat = guessCat(base, p.categories_tags);
  return { name, cat, icon: pickIcon(name, cat), size: typeof p.quantity === "string" ? normalizeSize(p.quantity) : "" };
}

/** Looks a barcode up in all public databases at once; the first one that knows it wins and the rest are cancelled.
 * Returns null when nobody knows it (the user names it once), or after 5 s. */
export async function lookupBarcode(code: string, fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<Product | null> {
  if (!isBarcode(code)) return null;
  const ctl = new AbortController(); // AbortSignal.timeout is missing on iOS < 16
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const tries = SOURCES.flatMap((s) => codeVariants(code).map(async (c) => {
    const r = await fetchFn(`${s.host}/api/v2/product/${c}.json?fields=product_name,product_name_en,brands,quantity,categories_tags`, { signal: ctl.signal });
    const p = r.ok ? parse(await r.json(), s.cat) : null;
    if (!p) throw new Error("not here");
    return p;
  }));
  try { return await Promise.any(tries); } // offline, slow or unknown everywhere: null
  catch { return null; }
  finally { clearTimeout(t); ctl.abort(); }
}
