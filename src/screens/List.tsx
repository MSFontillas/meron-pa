import { useState } from "preact/hooks";
import { CATS, type Item } from "../data/types";

export const QUICK: [string, string][] = [["Kangkong", "🥬"], ["Tomatoes", "🍅"], ["Onions", "🧅"], ["Garlic", "🧄"], ["Pork", "🥩"], ["Chicken", "🍗"], ["Bangus", "🐟"], ["Pandesal", "🥖"]];

interface Props { items: Item[]; onAdd: (name: string, icon?: string) => void; onTick: (i: Item, v: boolean) => void; onPutAway: (b: Item[]) => void }

export function List({ items, onAdd, onTick, onPutAway }: Props) {
  const [text, setText] = useState("");
  const list = items.filter((i) => i.onList);
  const toBuy = list.filter((i) => !i.inBasket), got = list.filter((i) => i.inBasket), n = got.length;
  const row = (i: Item) => (
    <button class="check" role="checkbox" aria-checked={i.inBasket} key={i.id} data-item={i.name} onClick={() => onTick(i, !i.inBasket)}>
      <span class="box" aria-hidden="true">{i.inBasket ? "✓" : ""}</span><span class="emoji" aria-hidden="true">{i.icon}</span><span class="lbl">{i.name}</span>
    </button>
  );
  return (
    <>
      <p class="count">{toBuy.length} to buy</p>
      <form class="add-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text); setText(""); } }}>
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} placeholder="Add an item…" aria-label="Add an item" maxLength={40} autocomplete="off" />
        <button class="big" type="submit">Add</button>
      </form>
      {toBuy.length
        ? CATS.filter((c) => toBuy.some((i) => i.cat === c)).map((c) => <><div class="group-h">{c}</div>{toBuy.filter((i) => i.cat === c).map(row)}</>)
        : <div class="empty">{n ? <><b>Everything is in your basket</b>Put it away when you get home.</> : <><b>All done!</b>Nothing left to buy.</>}</div>}
      {n > 0 && (
        <div class="basket">
          <div class="group-h">In my basket ({n})</div>
          <p class="hint">Ticked by mistake? Tap it to put it back on the list.</p>
          {got.map(row)}
          <button class="big" onClick={() => onPutAway(got)}>Put {n} {n === 1 ? "item" : "items"} away</button>
        </div>
      )}
      <div class="group-h">Palengke quick add</div>
      <div class="quick-row">
        {QUICK.map(([q, ic]) => (
          <button key={q} aria-pressed={list.some((i) => i.name === q)} onClick={() => onAdd(q, ic)}>{ic} {q}</button>
        ))}
      </div>
    </>
  );
}
