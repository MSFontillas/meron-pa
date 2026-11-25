import { CATS, type Item } from "../data/types";
import { Swipe } from "./Swipe";

interface Props { items: Item[]; sizes: Record<string, string>; onRemove: (i: Item) => void; onTick: (i: Item, v: boolean) => void; onPutAway: (b: Item[]) => void }

export function List({ items, sizes, onRemove, onTick, onPutAway }: Props) {
  const list = items.filter((i) => i.onList);
  const toBuy = list.filter((i) => !i.inBasket), got = list.filter((i) => i.inBasket), n = got.length;
  const row = (i: Item) => (
    <Swipe key={i.id} onRight={() => onRemove(i)} rightLabel="Remove ✕"><button class="check" role="checkbox" aria-checked={i.inBasket} data-item={i.name} onClick={() => onTick(i, !i.inBasket)}>
      <span class="box" aria-hidden="true">{i.inBasket ? "✓" : ""}</span><span class="emoji" aria-hidden="true">{i.icon}</span><span class="lbl">{i.name}{i.barcode && sizes[i.barcode] && <small class="size">{sizes[i.barcode]}</small>}</span>
    </button></Swipe>
  );
  return (
    <>
      <p class="count">{toBuy.length} to buy</p>
      {toBuy.length
        ? CATS.filter((c) => toBuy.some((i) => i.cat === c)).map((c) => <><div class="group-h">{c}</div>{toBuy.filter((i) => i.cat === c).map(row)}</>)
        : <div class="empty">{n ? <><b>Everything is in your basket</b>Put it away when you get home.</> : <><b>All done!</b>Nothing left to buy. Swipe right on an item in At Home when it runs out, or scan it.</>}</div>}
      {n > 0 && (
        <div class="basket">
          <div class="group-h">In my basket ({n})</div>
          <p class="hint">Ticked by mistake? Tap it to put it back on the list.</p>
          {got.map(row)}
          <button class="big" onClick={() => onPutAway(got)}>Put {n} {n === 1 ? "item" : "items"} away</button>
        </div>
      )}
    </>
  );
}
