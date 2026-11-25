import { useState } from "preact/hooks";
import type { Item } from "../data/types";
import { AtHome } from "./AtHome";
import { List } from "./List";

const KEY = "tutorialSeen";
export function tutorialSeen(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } }

const sample = (id: string, name: string, icon: string, qty: number): Item =>
  ({ id, name, icon, cat: "Food & drinks", qty, unit: "", onList: false, inBasket: false });

const HINTS = [
  "Tap + on Eggs. You bought another tray.",
  "Toyo ran out. Swipe it to the right 👉",
  "Swipe Rice to the left 👈 to delete it.",
  "Oops! Tap Undo to bring Rice back.",
  "At the store: tap Toyo to put it in your basket.",
  "Back home: tap \"Put 1 item away\".",
];

/** First-open practice: the real At Home and List screens on sample items. Nothing is saved. */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Item[]>(() => [sample("r", "Rice", "🍚", 1), sample("e", "Eggs", "🥚", 6), sample("t", "Toyo", "🫙", 1)]);
  const [undo, setUndo] = useState<Item | null>(null);

  const done = () => { try { localStorage.setItem(KEY, "1"); } catch { /* shows again next time */ } onDone(); };
  const change = (id: string, ch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...ch } : x)));
  const drop = (i: Item) => { setItems((xs) => xs.filter((x) => x.id !== i.id)); setUndo(i); };
  const at = (s: number, ok: boolean) => { if (ok && step === s) setStep(s + 1); };

  const home = <AtHome items={items} sizes={{}} onEdit={() => {}}
    onInc={(i) => { change(i.id, { qty: i.qty + 1 }); at(0, i.id === "e"); }}
    onDec={(i) => change(i.id, i.qty <= 1 ? { qty: 0, onList: true } : { qty: i.qty - 1 })}
    onOut={(i) => { change(i.id, { qty: 0, onList: true, inBasket: false }); at(1, i.id === "t"); }}
    onDelete={(i) => { drop(i); at(2, i.id === "r"); }} />;
  const list = <List items={items} sizes={{}}
    onTick={(i, v) => { change(i.id, { inBasket: v }); at(4, i.id === "t" && v); }}
    onRemove={(i) => (i.qty > 0 ? change(i.id, { onList: false, inBasket: false }) : drop(i))}
    onPutAway={(b) => { b.forEach((i) => change(i.id, { onList: false, inBasket: false, qty: i.qty + 1 })); at(5, true); }} />;

  return (
    <div class="tut" role="dialog" aria-modal="true" aria-label="Practice">
      <header class="top">
        <h1>{step >= 4 ? "Shopping List" : "At Home"}</h1>
        <button class="top-btn" onClick={done}>Skip</button>
      </header>
      {step < 6 ? <>
        <p class="tut-hint" role="status"><small>Practice {step + 1} of 6 · nothing here is saved</small>{HINTS[step]}</p>
        <main class="view">{step >= 4 ? list : home}</main>
        {undo && <div class="toast"><span>{undo.name} deleted</span>
          <button class="toast-undo" onClick={() => { setItems((xs) => [...xs, undo]); setUndo(null); if (step === 3 && undo.id === "r") setTimeout(() => setStep(4), 1200); /* let them see Rice come back */ }}>Undo</button></div>}
      </> : (
        <div class="tut-end">
          <span aria-hidden="true">🎉</span>
          <h2>You're ready!</h2>
          <p><b>Scan</b> opens the camera by itself. New product? Type its name once.</p>
          <p><b>Share list</b> sends a link so your household sees the same list. No sign-up.</p>
          <button class="big" onClick={done}>Start using Meron Pa?</button>
        </div>
      )}
    </div>
  );
}
