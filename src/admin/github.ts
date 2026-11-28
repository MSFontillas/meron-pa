import { CATALOG_REPO } from "../config";
import { mergeRows, type CatalogRow } from "../data/catalogRows";

const API = "https://api.github.com";
const FILE = "data/products.csv";
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });

const utf8ToB64 = (s: string) => { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
const b64ToUtf8 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

export type Check = { ok: true } | { ok: false; why: string };

/** Does this token let us write to the repo? Reads only. */
export async function checkToken(token: string, fetchFn: typeof fetch = fetch): Promise<Check> {
  try {
    const r = await fetchFn(`${API}/repos/${CATALOG_REPO}`, { headers: headers(token), cache: "no-store" });
    if (r.status === 401) return { ok: false, why: "GitHub did not accept that token." };
    if (!r.ok) return { ok: false, why: `GitHub answered ${r.status}. Is the token limited to the ${CATALOG_REPO} repository?` };
    const j = await r.json();
    return j?.permissions?.push ? { ok: true } : { ok: false, why: "That token can read the repository but not change it. Give it Contents: Read and write." };
  } catch { return { ok: false, why: "Could not reach GitHub. Check your internet." }; }
}

/** Adds the rows to data/products.csv in one commit (replacing rows with the same barcode). Retries once if the file changed meanwhile. */
export async function pushRows(token: string, rows: CatalogRow[], fetchFn: typeof fetch = fetch): Promise<void> {
  const url = `${API}/repos/${CATALOG_REPO}/contents/${FILE}`;
  for (let attempt = 0; ; attempt++) {
    const g = await fetchFn(`${url}?ref=main`, { headers: headers(token), cache: "no-store" });
    if (g.status !== 404 && !g.ok) throw new Error(g.status === 401 ? "GitHub did not accept the token." : `GitHub answered ${g.status}.`);
    const cur = g.status === 404 ? null : await g.json();
    const text = cur ? b64ToUtf8(cur.content) : "";
    const body = { message: `Add ${rows.length} ${rows.length === 1 ? "product" : "products"} via app`, content: utf8ToB64(mergeRows(text, rows)), branch: "main", ...(cur ? { sha: cur.sha } : {}) };
    const p = await fetchFn(url, { method: "PUT", headers: { ...headers(token), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (p.ok) return;
    if ((p.status === 409 || p.status === 422) && attempt === 0) continue; // somebody changed the file between our read and write
    throw new Error(p.status === 403 || p.status === 404 ? "The token may not change this repository." : `GitHub answered ${p.status}.`);
  }
}
