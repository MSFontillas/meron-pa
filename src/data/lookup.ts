import { cleanName, normalizeSize, pickIcon, type Cat, type Product } from "./types";

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

function guessCat(base: Cat, tags: unknown): Cat {
  const t = Array.isArray(tags) ? tags.join(" ") : "";
  if (/laundry|detergent|fabric-softener/.test(t)) return "Laundry";
  if (/diaper|nappies|baby-wipes|infant-formula/.test(t)) return "Baby";
  if (/cleaning|dishwashing|bleach|disinfectant|toilet-cleaner/.test(t)) return "Cleaning";
  if (/shampoo|soap|toothpaste|toilet-paper|deodorant/.test(t)) return "Bathroom";
  return base;
}

/** Looks a barcode up in the public databases. Returns null when nobody knows it (the user names it once). */
export async function lookupBarcode(code: string, fetchFn: typeof fetch = fetch): Promise<Product | null> {
  if (!isBarcode(code)) return null;
  for (const s of SOURCES) for (const c of codeVariants(code)) {
    try {
      const ctl = new AbortController(); // AbortSignal.timeout is missing on iOS < 16
      const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetchFn(`${s.host}/api/v2/product/${c}.json?fields=product_name,product_name_en,brands,quantity,categories_tags`,
        { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) continue;
      const j = await r.json();
      const p = j?.product;
      const raw = typeof p?.product_name === "string" && p.product_name.trim() ? p.product_name
        : typeof p?.product_name_en === "string" ? p.product_name_en : "";
      if (j?.status !== 1 || !raw.trim()) continue;
      const brand = typeof p.brands === "string" ? p.brands.split(",")[0].trim() : "";
      const name = cleanName(brand && !raw.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${raw}` : raw);
      const cat = guessCat(s.cat, p.categories_tags);
      return { name, cat, icon: pickIcon(name, cat), size: typeof p.quantity === "string" ? normalizeSize(p.quantity) : "" };
    } catch { /* offline, slow or blocked: try the next source */ }
  }
  return null;
}
