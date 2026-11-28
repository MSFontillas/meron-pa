import { codeVariants } from "./lookup";
import { CATS, pickIcon, type Cat, type Product } from "./types";

// The app's own product list (public/catalog.json, built from the Open Food Facts mirror plus data/products.csv).
// Fetched once on first scan; the service worker keeps it for offline use. { barcode: [name, kind, size] }
type Catalog = Record<string, [string, string, string]>;
let cache: Promise<Catalog> | null = null;

export function loadCatalog(fetchFn: typeof fetch = fetch): Promise<Catalog> {
  cache ??= fetchFn(`${import.meta.env.BASE_URL}catalog.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Catalog>) : {}))
    .catch(() => ({}))
    .then((c) => { if (!Object.keys(c).length) cache = null; return c; }); // failed or empty: try again next scan
  return cache;
}

export async function lookupCatalog(code: string, fetchFn: typeof fetch = fetch): Promise<Product | null> {
  const c = await loadCatalog(fetchFn);
  const row = codeVariants(code).map((v) => c[v]).find(Boolean);
  if (!row) return null;
  const cat: Cat = (CATS as readonly string[]).includes(row[1]) ? (row[1] as Cat) : "Other";
  return { name: row[0], cat, icon: pickIcon(row[0], cat), size: row[2] };
}

export const resetCatalog = () => { cache = null; };
