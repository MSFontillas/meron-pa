import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CATS, catClass, type Item } from "../data/types";
import { useDialog } from "./useDialog";

export type Stock = { qty: number; onList: boolean };
interface Props {
  items: Item[];
  sizes: Record<string, string>;
  onAnswer: (i: Item, s: Stock) => void;
  onClose: (goToList: boolean) => void;
  hint?: ComponentChildren; // practice demo only
  closeLabel?: string;
}

/** Before shopping: one item at a time, "Ubos na / Kaunti na / Meron pa". Each answer is saved at once. */
export function StockCheck({ items, sizes, onAnswer, onClose, hint, closeLabel }: Props) {
  // A fixed snapshot: answering changes onList, which must not reshuffle the walk.
  const [todo] = useState(() => CATS.flatMap((c) => items.filter((i) => !i.onList && i.cat === c)));
  const [orig] = useState(() => Object.fromEntries(todo.map((i) => [i.id, i.qty]))); // answers change qty live; keep the count you started from
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Stock>>({});
  const it = todo[idx];
  const [n, setN] = useState(it ? orig[it.id] : 0);
  const head = useRef<HTMLHeadingElement>(null);
  const dlg = useDialog(() => onClose(false));
  useEffect(() => { if (it) setN(orig[it.id]); head.current?.focus(); }, [idx]); // screen readers hear the next item

  const answer = (s: Stock) => { onAnswer(it, s); setAnswers({ ...answers, [it.id]: s }); setIdx(idx + 1); };
  const added = Object.values(answers).filter((a) => a.onList).length;
  const below = !!it?.want && n < it.want;

  return (
    <div class="tut" role="dialog" aria-modal="true" aria-labelledby="sc-h" tabIndex={-1} ref={dlg.ref as never}>
      <header class="top">
        <h1 id="sc-h">Check stock</h1>
        <button class="top-btn" onClick={() => onClose(false)}>{closeLabel ?? (it ? "Stop" : "Close")}</button>
      </header>
      {hint}
      {!todo.length ? (
        <div class="tut-end"><h2>Nothing to check yet</h2><p>Scan or add the things you usually buy, then check them here before shopping.</p></div>
      ) : it ? (
        <div class="sc">
          <p class="count" aria-live="polite">{idx + 1} of {todo.length}</p>
          <div class="sc-item">
            <span class={`sc-ic ${catClass(it.cat)}`} aria-hidden="true">{it.icon}</span>
            <h2 tabIndex={-1} ref={head}>{it.name}</h2>
            <p class="meta">{[it.barcode && sizes[it.barcode], `Last count: ${orig[it.id]}`, it.want ? `Usually keep ${it.want}` : ""].filter(Boolean).join(" · ")}</p>
          </div>
          <div class="sc-count">
            <span id="sc-n">How many left? (optional)</span>
            <div class="stepper" role="group" aria-labelledby="sc-n">
              <button onClick={() => setN(Math.max(0, n - 1))} aria-label="One less">−</button>
              <output aria-live="polite">{n}</output>
              <button onClick={() => setN(Math.min(999, n + 1))} aria-label="One more">+</button>
            </div>
          </div>
          <div class="sc-btns">
            <button class="sc-out" onClick={() => answer({ qty: 0, onList: true })}><span lang="fil">Ubos na</span> <small>None left · add to list</small></button>
            <button class="sc-low" onClick={() => answer({ qty: n, onList: true })}><span lang="fil">Kaunti na</span> <small>Running low · add to list</small></button>
            <button class="sc-ok" onClick={() => answer({ qty: n, onList: below })}><span lang="fil">Meron pa</span> <small>{below ? `Below your usual ${it.want} · add to list` : "Enough for now"}</small></button>
          </div>
          {idx > 0 && <button class="link" onClick={() => setIdx(idx - 1)}>Back</button>}
        </div>
      ) : (
        <div class="tut-end">
          <span aria-hidden="true">🛒</span>
          <h2 tabIndex={-1} ref={head}>{added ? `${added} ${added === 1 ? "thing" : "things"} added to your list` : "You have everything"}</h2>
          <button class="big" onClick={() => onClose(true)}>Go to my list</button>
        </div>
      )}
    </div>
  );
}
