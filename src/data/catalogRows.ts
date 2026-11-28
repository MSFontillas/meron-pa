// The admin's product list (data/products.csv): reading, checking and updating it.
// Shared by the catalog build script and the in-app admin mode, so the rules cannot drift apart.
import { CATS, LIMITS } from "./types.ts";

export interface CatalogRow { code: string; name: string; brand: string; size: string; kind: string; giveBack: boolean }
export const CSV_HEAD = "barcode,name,brand,size,kind,give_back";

/** Parses CSV text (BOM, quoted fields with commas/quotes/newlines, blank lines). Returns rows of {line, cells}. */
export function parseCsv(text: string): { line: number; cells: string[] }[] {
  text = text.replace(/^﻿/, "");
  const rows: { line: number; cells: string[] }[] = [];
  let row: string[] = [], cell = "", q = false, line = 1, start = 1;
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
export function validGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = [...code].map(Number), check = d.pop()!;
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** "" when the row is fine, otherwise what is wrong with it. */
export function checkRow(r: Pick<CatalogRow, "code" | "name" | "size" | "kind">): string {
  return !validGtin(r.code) ? `barcode "${r.code}" is not a valid 8, 12 or 13 digit barcode (check digit)`
    : !r.name || r.name.length > LIMITS.name ? `name must be 1-${LIMITS.name} characters`
    : !(CATS as readonly string[]).includes(r.kind) ? `kind "${r.kind}" must be one of: ${CATS.join(", ")}`
    : r.size.length > LIMITS.size ? `size must be at most ${LIMITS.size} characters` : "";
}

/** Turns CSV text into validated rows; throws one Error naming every bad line. */
export function csvProducts(text: string): CatalogRow[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const cols = head.cells.map((c) => c.trim().toLowerCase());
  const at = (n: string) => cols.indexOf(n);
  for (const n of ["barcode", "name", "kind"]) if (at(n) < 0) throw new Error(`products.csv: missing column "${n}"`);
  const bad: string[] = [], out: CatalogRow[] = [];
  for (const { line, cells } of rows) {
    const get = (n: string) => (at(n) < 0 ? "" : (cells[at(n)] ?? "").trim());
    const r = { code: get("barcode"), name: get("name"), brand: get("brand"), size: get("size"), kind: get("kind"), giveBack: get("give_back").toLowerCase() === "yes" };
    const err = checkRow(r);
    if (err) bad.push(`products.csv line ${line}: ${err}`); else out.push(r);
  }
  if (bad.length) throw new Error(bad.join("\n"));
  return out;
}

const quote = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toLine = (r: CatalogRow) => [r.code, r.name, r.brand, r.size, r.kind, r.giveBack ? "yes" : ""].map(quote).join(",");

/** Adds `add` to the CSV text: a row with the same barcode is replaced, new ones go at the end. Refuses bad rows. */
export function mergeRows(text: string, add: CatalogRow[]): string {
  const bad = add.map((r) => checkRow(r) && `${r.code || "(no barcode)"}: ${checkRow(r)}`).filter(Boolean);
  if (bad.length) throw new Error(bad.join("\n"));
  const rows = text.trim() ? csvProducts(text) : [];
  for (const r of add) {
    const i = rows.findIndex((x) => x.code === r.code);
    if (i >= 0) rows[i] = r; else rows.push(r);
  }
  return [CSV_HEAD, ...rows.map(toLine)].join("\n") + "\n";
}
