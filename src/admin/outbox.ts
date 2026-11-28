import type { CatalogRow } from "../data/catalogRows";
import { pushRows } from "./github";

const TOKEN = "adminToken", BOX = "catalogOutbox";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* not remembered */ } };

export const getToken = () => get(TOKEN);
export const setToken = (t: string | null) => set(TOKEN, t);

export function queued(): CatalogRow[] {
  try { const j = JSON.parse(get(BOX) ?? "[]"); return Array.isArray(j) ? j : []; } catch { return []; }
}

/** Keeps the row until it is sent, so a product named offline is not lost. A later row for the same barcode replaces it. */
export function enqueue(row: CatalogRow): number {
  const rows = queued().filter((r) => r.code !== row.code);
  rows.push(row);
  set(BOX, JSON.stringify(rows));
  return rows.length;
}

const same = (a: CatalogRow, b: CatalogRow) => JSON.stringify(a) === JSON.stringify(b);

/** Sends everything waiting in one commit; on failure the rows stay queued and the error is thrown. Returns how many were sent. */
export async function flush(token: string, push: typeof pushRows = pushRows): Promise<number> {
  const rows = queued();
  if (!rows.length) return 0;
  await push(token, rows);
  set(BOX, JSON.stringify(queued().filter((q) => !rows.some((r) => same(r, q))))); // keep rows added while sending
  return rows.length;
}
