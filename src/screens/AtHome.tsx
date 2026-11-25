import { CATS, catClass, type Item } from "../data/types";
import { Swipe } from "./Swipe";

interface Props { items: Item[]; sizes: Record<string, string>; onInc: (i: Item) => void; onDec: (i: Item) => void; onOut: (i: Item) => void; onDelete: (i: Item) => void; onEdit: (i: Item) => void; onAdd?: () => void; onCheck?: () => void }

export function AtHome({ items, sizes, onInc, onDec, onOut, onDelete, onEdit, onAdd, onCheck }: Props) {
  const home = items.filter((i) => i.qty > 0);
  return (
    <>
      {onCheck && <button class="big home-check" onClick={onCheck}>Check stock before shopping</button>}
      <p class="count">{home.length} {home.length === 1 ? "item" : "items"} at home</p>
      {home.length === 0 && <div class="empty"><b>Nothing here yet</b>Scan something, or add it by hand.</div>}
      {CATS.filter((c) => home.some((i) => i.cat === c)).map((c) => (
        <>
          <div class="group-h">{c}</div>
          {home.filter((i) => i.cat === c).map((i) => (
            <Swipe key={i.id} onRight={() => onOut(i)} rightLabel="🛒 Ran out" onLeft={() => onDelete(i)} leftLabel="Delete 🗑️">
            <div class="item" data-item={i.name}>
              <span class={`pic ${catClass(i.cat)}`} aria-hidden="true">{i.icon}</span>
              <div class="item-main">
                <button class="item-name" onClick={() => onEdit(i)}>{i.name}</button>
                <small class="size">{[i.unit, i.barcode && sizes[i.barcode]].filter(Boolean).join(" · ")}</small>
              </div>
              <div class="stepper">
                <button onClick={() => onDec(i)} aria-label={`One less ${i.name}`}>−</button>
                <output aria-label={`${i.qty} at home`}>{i.qty}</output>
                <button onClick={() => onInc(i)} aria-label={`One more ${i.name}`}>+</button>
              </div>
            </div>
            </Swipe>
          ))}
        </>
      ))}
      {onAdd && <button class="link" onClick={onAdd}>Add something by hand</button>}
    </>
  );
}
