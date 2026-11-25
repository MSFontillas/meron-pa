import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, increment, serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { appCheckKey, firebaseConfig, useEmulator } from "../config";
import { CATS, LIMITS, cleanName, normalizeSize, pickIcon, type Cat, type Item, type Product } from "./types";

let db: Firestore;
let auth: Auth;

/** Starts Firebase with an offline cache and an invisible anonymous sign-in (no account, no email). */
export async function initStore(): Promise<void> {
  const app = initializeApp(firebaseConfig);
  // App Check proves requests come from this app on a real browser, so scripts can't burn the free quota.
  if (appCheckKey && !useEmulator) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckKey), isTokenAutoRefreshEnabled: true });
  // No popup/redirect sign-in is ever used, so skip that code (smaller download).
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (useEmulator) {
    const host = location.hostname || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
  await auth.authStateReady(); // restores the saved anonymous user, if any
  if (!auth.currentUser) await signInAnonymously(auth);
}

const itemsCol = (home: string) => collection(db, "homes", home, "items");
const itemRef = (home: string, id: string) => doc(db, "homes", home, "items", id);

function toItem(id: string, d: Record<string, unknown>): Item | null {
  if (typeof d.name !== "string" || typeof d.qty !== "number") return null;
  const cat = (CATS as readonly string[]).includes(d.cat as string) ? (d.cat as Cat) : "Other";
  return {
    id, name: d.name, cat, qty: d.qty,
    icon: pickIcon(d.name, cat), // derived, so old items match the new icon set
    unit: typeof d.unit === "string" ? d.unit : "",
    onList: d.onList === true, inBasket: d.inBasket === true,
    barcode: typeof d.barcode === "string" ? d.barcode : undefined,
    want: typeof d.want === "number" && d.want > 0 ? d.want : undefined,
  };
}

export function watchItems(home: string, onItems: (items: Item[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(itemsCol(home), (snap) => {
    const items: Item[] = [];
    snap.forEach((d) => { const it = toItem(d.id, d.data()); if (it) items.push(it); });
    items.sort((a, b) => a.name.localeCompare(b.name));
    onItems(items);
  }, onError);
}

// Writes are not awaited by the UI: offline writes resolve only when the server confirms.
type Fail = (e: unknown) => void;
const stamp = () => ({ updatedAt: serverTimestamp() });

export function findSame(items: Item[], name: string, barcode?: string): Item | undefined {
  const n = name.toLowerCase();
  return items.find((i) => (barcode && i.barcode === barcode) || i.name.toLowerCase() === n);
}

export interface NewThing { name: string; icon?: string; cat: Cat; unit?: string; barcode?: string; want?: number }

function newDoc(t: NewThing, qty: number, onList: boolean) {
  const data: Record<string, unknown> = {
    name: cleanName(t.name), icon: (t.icon || pickIcon(t.name, t.cat)).slice(0, LIMITS.icon), cat: t.cat,
    qty, unit: (t.unit || "").slice(0, LIMITS.unit), onList, inBasket: false, ...stamp(),
  };
  if (t.barcode) data.barcode = t.barcode;
  if (t.want) data.want = Math.min(LIMITS.qty, Math.round(t.want));
  return data;
}

/** Adds to At Home. Bought it, so it also comes off the shopping list. Returns the item id. */
export function addToHome(home: string, items: Item[], t: NewThing, fail: Fail, qty = 1): string {
  const n = Math.max(1, Math.min(LIMITS.qty, Math.round(qty)));
  const same = findSame(items, t.name, t.barcode);
  const ref = same ? itemRef(home, same.id) : doc(itemsCol(home));
  (same ? updateDoc(ref, { qty: increment(n), onList: false, inBasket: false, ...stamp() }) : setDoc(ref, newDoc(t, n, false))).catch(fail);
  return ref.id;
}

export function addToList(home: string, items: Item[], t: NewThing, fail: Fail): string {
  const same = findSame(items, t.name, t.barcode);
  const ref = same ? itemRef(home, same.id) : doc(itemsCol(home));
  (same ? updateDoc(ref, { onList: true, ...stamp() }) : setDoc(ref, newDoc(t, 0, true))).catch(fail);
  return ref.id;
}

export function changeQty(home: string, item: Item, delta: 1 | -1, fail: Fail): void {
  if (delta === -1 && item.qty <= 1) return ranOut(home, item, fail);
  updateDoc(itemRef(home, item.id), { qty: increment(delta), ...stamp() }).catch(fail);
}

export function ranOut(home: string, item: Item, fail: Fail): void {
  updateDoc(itemRef(home, item.id), { qty: 0, onList: true, inBasket: false, ...stamp() }).catch(fail);
}

export function setInBasket(home: string, item: Item, inBasket: boolean, fail: Fail): void {
  updateDoc(itemRef(home, item.id), { inBasket, ...stamp() }).catch(fail);
}

export function putAway(home: string, basket: Item[], fail: Fail): void {
  const b = writeBatch(db);
  // Bought up to the usual amount when there is one; otherwise one more.
  for (const it of basket) b.update(itemRef(home, it.id), { onList: false, inBasket: false, qty: it.want ? Math.max(it.want, it.qty) : increment(1), ...stamp() });
  b.commit().catch(fail);
}

export function editItem(home: string, item: Item, ch: { name: string; cat: Cat; qty: number; unit: string; want: number }, fail: Fail): void {
  const qty = Math.max(0, Math.min(LIMITS.qty, Math.round(ch.qty)));
  const want = Math.max(0, Math.min(LIMITS.qty, Math.round(ch.want || 0)));
  updateDoc(itemRef(home, item.id), {
    // only written when set, so homes whose rules predate "want" keep working
    ...(want || item.want ? { want } : {}),
    name: cleanName(ch.name) || item.name, cat: ch.cat, qty, unit: ch.unit.slice(0, LIMITS.unit),
    onList: qty === 0 ? true : item.onList, // nothing left at home: it goes on the list
    icon: pickIcon(ch.name, ch.cat), ...stamp(),
  }).catch(fail);
}

/** Writes an item back exactly as it was (Undo). */
export function restore(home: string, it: Item, fail: Fail): void {
  const data: Record<string, unknown> = {
    name: it.name, icon: it.icon.slice(0, LIMITS.icon), cat: it.cat, qty: it.qty, unit: it.unit.slice(0, LIMITS.unit),
    onList: it.onList, inBasket: it.inBasket, ...stamp(),
  };
  if (it.barcode) data.barcode = it.barcode;
  if (it.want) data.want = it.want;
  setDoc(itemRef(home, it.id), data).catch(fail);
}

/** Stock check answer: what's left, and whether it goes on the list. */
export function setStock(home: string, it: Item, s: { qty: number; onList: boolean }, fail: Fail): void {
  updateDoc(itemRef(home, it.id), { qty: Math.max(0, Math.min(LIMITS.qty, s.qty)), onList: s.onList, inBasket: false, ...stamp() }).catch(fail);
}

/** Off the shopping list. Still stocked at home: keep it there; otherwise it is gone. */
export function removeFromList(home: string, it: Item, fail: Fail): void {
  (it.qty > 0 ? updateDoc(itemRef(home, it.id), { onList: false, inBasket: false, ...stamp() }) : deleteDoc(itemRef(home, it.id))).catch(fail);
}

export function removeItem(home: string, item: Pick<Item, "id">, fail: Fail): void {
  deleteDoc(itemRef(home, item.id)).catch(fail);
}

/** Copies this phone's items into another home (used when joining a shared list). */
export async function copyItems(toHome: string, items: Item[]): Promise<void> {
  const commits: Promise<void>[] = [];
  for (let i = 0; i < items.length; i += 400) { // Firestore allows at most 500 writes per batch
    const b = writeBatch(db);
    for (const it of items.slice(i, i + 400)) {
      b.set(doc(itemsCol(toHome)), newDoc({ name: it.name, icon: it.icon, cat: it.cat, unit: it.unit, barcode: it.barcode }, it.qty, it.onList));
    }
    commits.push(b.commit());
  }
  await Promise.all(commits);
}

// "Name it once": barcodes this home has named.
export async function getSavedProduct(home: string, code: string): Promise<Product | null> {
  try {
    const s = await getDoc(doc(db, "homes", home, "products", code));
    const d = s.data();
    return d && typeof d.name === "string" ? (d as Product) : null;
  } catch { return null; }
}

export function saveProduct(home: string, code: string, p: Product, fail: Fail): void {
  setDoc(doc(db, "homes", home, "products", code), {
    name: cleanName(p.name), icon: p.icon.slice(0, LIMITS.icon), cat: p.cat, size: p.size.slice(0, LIMITS.size),
  }).catch(fail);
}

/** barcode -> size text for every product this home has named (shown next to items). */
export function watchSizes(home: string, onSizes: (m: Record<string, string>) => void): () => void {
  return onSnapshot(collection(db, "homes", home, "products"), (snap) => {
    const m: Record<string, string> = {};
    snap.forEach((d) => { const s = d.data().size; if (typeof s === "string" && s) m[d.id] = normalizeSize(s); });
    onSizes(m);
  }, () => {});
}
