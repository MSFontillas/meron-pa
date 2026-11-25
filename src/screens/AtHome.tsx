import { CATS, type Item } from "../data/types";

interface Props { items: Item[]; sizes: Record<string, string>; onInc: (i: Item) => void; onDec: (i: Item) => void; onOut: (i: Item) => void; onEdit: (i: Item) => void; onAdd: () => void }

export function AtHome({ items, sizes, onInc, onDec, onOut, onEdit, onAdd }: Props) {
  const home = items.filter((i) => i.qty > 0);
  return (
    <>
      <p class="count">{home.length} {home.length === 1 ? "item" : "items"} at home</p>
      {home.length === 0 && <div class="empty"><b>Nothing here yet</b>Scan something, or add it by hand.</div>}
      {CATS.filter((c) => home.some((i) => i.cat === c)).map((c) => (
        <>
          <div class="group-h">{c}</div>
          {home.filter((i) => i.cat === c).map((i) => (
            <div class="item" key={i.id} data-item={i.name}>
              <span class="pic" aria-hidden="true">{i.icon}</span>
              <button class="item-name" onClick={() => onEdit(i)}>{i.name}{i.barcode && sizes[i.barcode] && <small class="size">{sizes[i.barcode]}</small>}</button>
              <div class="item-actions">
                <div class="stepper">
                  <button onClick={() => onDec(i)} aria-label={`One less ${i.name}`}>−</button>
                  <output>{i.qty} {i.unit}</output>
                  <button onClick={() => onInc(i)} aria-label={`One more ${i.name}`}>+</button>
                </div>
                <button class="ghost" onClick={() => onOut(i)}>Ran out</button>
              </div>
            </div>
          ))}
        </>
      ))}
      <button class="link" onClick={onAdd}>Add something by hand</button>
    </>
  );
}
