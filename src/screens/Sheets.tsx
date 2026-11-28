import { useMemo, useState } from "preact/hooks";

import { useDialog } from "./useDialog";
import { CATS, pesoInput, type Cat, type Item } from "../data/types";

export interface EditValues { name: string; cat: Cat; qty: number; unit: string; want: number; price: string }

export function EditSheet({ item, onSave, onRemove, onClose }: {
  item: Item | null; onSave: (v: EditValues) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [v, setV] = useState<EditValues>({ name: item?.name ?? "", cat: item?.cat ?? "Food & drinks", qty: item?.qty ?? 1, unit: item?.unit ?? "", want: item?.want ?? 0, price: item?.price ? pesoInput(item.price) : "" });
  const set = (k: keyof EditValues) => (e: Event) => {
    const t = e.target as HTMLInputElement;
    setV({ ...v, [k]: k === "qty" || k === "want" ? Number(t.value) : t.value });
  };
  const dlg = useDialog(onClose);
  return (
    <div class="sheet-bg" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabIndex={-1} ref={dlg.ref as never} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="sheet" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSave(v); }}>
        <h2 id="sheet-h">{item ? "Edit item" : "Add item"}</h2>
        <div class="field"><label for="f-name">Name</label><input id="f-name" value={v.name} onInput={set("name")} maxLength={40} required autoFocus={!item} /></div>
        <div class="field"><label for="f-cat">Kind</label>
          <select id="f-cat" value={v.cat} onChange={set("cat")}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div class="field-row">
          <div class="field"><label for="f-qty">How many at home?</label><input id="f-qty" type="number" min={0} max={999} inputMode="numeric" value={v.qty} onInput={set("qty")} /></div>
          <div class="field"><label for="f-unit">Unit</label><input id="f-unit" value={v.unit} onInput={set("unit")} maxLength={12} placeholder="packs, kg, sachets" /></div>
        </div>
        <div class="field"><label for="f-price">Price (₱, optional)</label>
          <input id="f-price" value={v.price} onInput={set("price")} inputMode="decimal" placeholder="e.g. 45.50" maxLength={10} /></div>
        <div class="field"><label for="f-want">Usually keep (optional)</label>
          <input id="f-want" type="number" min={0} max={999} inputMode="numeric" value={v.want || ""} onInput={set("want")} placeholder="e.g. 12" aria-describedby="f-want-hint" />
          <small id="f-want-hint" class="hint">Your shopping list will say how many to buy.</small></div>
        <div class="two"><button type="button" class="big outline" onClick={onClose}>Cancel</button><button class="big" type="submit">Save</button></div>
        {onRemove && <button type="button" class="big danger" onClick={onRemove}>Delete this item</button>}
      </form>
    </div>
  );
}

export function JoinSheet({ myCount, onJoin, onCancel }: { myCount: number; onJoin: (bring: boolean) => void; onCancel: () => void }) {
  const dlg = useDialog(onCancel);
  return (
    <div class="sheet-bg">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Join this list?" tabIndex={-1} ref={dlg.ref as never}>
        <h2>Join this shared list?</h2>
        <p class="hint">You'll see and change the same list as the person who sent the link.</p>
        {myCount > 0
          ? <><button class="big" onClick={() => onJoin(true)}>Join and bring my {myCount} {myCount === 1 ? "item" : "items"}</button>
              <button class="big outline" onClick={() => onJoin(false)}>Join without my items</button></>
          : <button class="big" onClick={() => onJoin(false)}>Join</button>}
        <button class="link" onClick={onCancel}>Not now</button>
      </div>
    </div>
  );
}
