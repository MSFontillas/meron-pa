import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, increment, serverTimestamp, deleteDoc, collectionGroup } from "firebase/firestore";

let env: RulesTestEnvironment;
const HOME = "AbCdEfGhIjKlMnOpQrStUv"; // 22 chars
const item = (extra: object = {}) => ({ name: "Rice", icon: "🍚", cat: "Food & drinks", qty: 1, unit: "bag", onList: false, inBasket: false, updatedAt: serverTimestamp(), ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-grocery", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
afterAll(() => env.cleanup());

describe("firestore rules", () => {
  it("lets a signed-in phone create, change, read and delete items in a home", async () => {
    const db = env.authenticatedContext("phone1").firestore();
    const ref = doc(db, "homes", HOME, "items", "rice");
    await assertSucceeds(setDoc(ref, item({ barcode: "4801234012342" })));
    await assertSucceeds(updateDoc(ref, { qty: increment(1), updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(db, "homes", HOME, "items")));
    const other = env.authenticatedContext("phone2").firestore(); // someone with the link
    await assertSucceeds(getDoc(doc(other, "homes", HOME, "items", "rice")));
    await assertSucceeds(deleteDoc(ref));
  });
  it("refuses phones that are not signed in", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(db, "homes", HOME, "items")));
    await assertFails(setDoc(doc(db, "homes", HOME, "items", "x"), item()));
  });
  it("never allows listing homes or searching items across homes", async () => {
    const db = env.authenticatedContext("phone1").firestore();
    await assertFails(getDocs(collection(db, "homes")));
    await assertFails(getDocs(collectionGroup(db, "items")));
  });
  it("refuses short home ids and bad item data", async () => {
    const db = env.authenticatedContext("phone1").firestore();
    await assertFails(setDoc(doc(db, "homes", "short", "items", "x"), item()));
    const ref = doc(db, "homes", HOME, "items", "bad");
    await assertFails(setDoc(ref, item({ cat: "Weapons" })));
    await assertFails(setDoc(ref, item({ qty: -1 })));
    await assertFails(setDoc(ref, item({ qty: 1.5 })));
    await assertFails(setDoc(ref, item({ name: "x".repeat(41) })));
    await assertFails(setDoc(ref, item({ name: "" })));
    await assertFails(setDoc(ref, item({ extra: "field" })));
    await assertFails(setDoc(ref, item({ barcode: "abc" })));
    await assertFails(setDoc(ref, item({ updatedAt: new Date(0) })));
  });
  it("validates named products", async () => {
    const db = env.authenticatedContext("phone1").firestore();
    await assertSucceeds(setDoc(doc(db, "homes", HOME, "products", "4809012090124"), { name: "Ube jam", icon: "📦", cat: "Other", size: "" }));
    await assertFails(setDoc(doc(db, "homes", HOME, "products", "notacode"), { name: "x", icon: "📦", cat: "Other", size: "" }));
    await assertFails(setDoc(doc(db, "homes", HOME, "products", "4809012090124"), { name: "x", icon: "📦", cat: "Other", size: "", spam: 1 }));
  });
});
