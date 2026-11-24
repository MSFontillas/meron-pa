// A "home" is a shared list, addressed by an unguessable random ID (like a house key).
const KEY = "homeId";
const PREV = "prevHomeId";
const ID_RE = /^[A-Za-z0-9_-]{22,64}$/;

export function newHomeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isHomeId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

export function getHomeId(storage: Storage = localStorage): string {
  let id: string | null = null;
  try { id = storage.getItem(KEY); } catch { /* storage blocked: fall through */ }
  if (isHomeId(id)) return id;
  id = newHomeId();
  try { storage.setItem(KEY, id); } catch { /* keep in memory only */ }
  return id;
}

/** Switches lists; the current one is remembered so the user can go back to it. */
export function setHomeId(id: string, storage: Storage = localStorage): void {
  if (!isHomeId(id)) throw new Error("Invalid home link");
  try {
    const cur = storage.getItem(KEY);
    if (isHomeId(cur) && cur !== id) storage.setItem(PREV, cur);
    storage.setItem(KEY, id);
  } catch { /* ignore */ }
}

export function getPrevHomeId(storage: Storage = localStorage): string | null {
  try { const p = storage.getItem(PREV); return isHomeId(p) ? p : null; } catch { return null; }
}

/** The link puts the ID after "#" so it never reaches the web host's logs. */
export function shareLink(id: string, loc: { origin: string; pathname: string } = location): string {
  return `${loc.origin}${loc.pathname}#join=${id}`;
}

export function joinIdFromHash(hash: string): string | null {
  const m = /^#join=([A-Za-z0-9_-]+)$/.exec(hash);
  return m && isHomeId(m[1]) ? m[1] : null;
}
