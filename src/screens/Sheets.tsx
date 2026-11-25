import { useEffect, useMemo, useRef, useState } from "preact/hooks";

/** Dialog behaviour: focus moves in on open, Escape closes (the backdrop tap is a mouse/touch extra). */
function useDialog(onClose?: () => void) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => back?.focus?.(); // focus returns to the button that opened it
  }, []);
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); } };
  return { ref, onKeyDown };
}
import qrcode from "qrcode-generator";
import { CATS, type Cat, type Item } from "../data/types";

export interface EditValues { name: string; cat: Cat; qty: number; unit: string; want: number }

export function EditSheet({ item, onSave, onRemove, onClose }: {
  item: Item | null; onSave: (v: EditValues) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [v, setV] = useState<EditValues>({ name: item?.name ?? "", cat: item?.cat ?? "Food & drinks", qty: item?.qty ?? 1, unit: item?.unit ?? "", want: item?.want ?? 0 });
  const set = (k: keyof EditValues) => (e: Event) => {
    const t = e.target as HTMLInputElement;
    setV({ ...v, [k]: k === "qty" || k === "want" ? Number(t.value) : t.value });
  };
  const dlg = useDialog(onClose);
  return (
    <div class="sheet-bg" role="dialog" aria-modal="true" aria-labelledby="sheet-h" tabIndex={-1} ref={dlg.ref as never} onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={dlg.onKeyDown}>
      <form class="sheet" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSave(v); }}>
        <h2 id="sheet-h">{item ? "Edit item" : "Add item"}</h2>
        <div class="field"><label for="f-name">Name</label><input id="f-name" value={v.name} onInput={set("name")} maxLength={40} required autoFocus={!item} /></div>
        <div class="field"><label for="f-cat">Kind</label>
          <select id="f-cat" value={v.cat} onChange={set("cat")}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div class="field-row">
          <div class="field"><label for="f-qty">How many at home?</label><input id="f-qty" type="number" min={0} max={999} inputMode="numeric" value={v.qty} onInput={set("qty")} /></div>
          <div class="field"><label for="f-unit">Unit</label><input id="f-unit" value={v.unit} onInput={set("unit")} maxLength={12} placeholder="packs, kg, sachets" /></div>
        </div>
        <div class="field"><label for="f-want">Usually keep (optional)</label>
          <input id="f-want" type="number" min={0} max={999} inputMode="numeric" value={v.want || ""} onInput={set("want")} placeholder="e.g. 12" aria-describedby="f-want-hint" />
          <small id="f-want-hint" class="hint">Your shopping list will say how many to buy.</small></div>
        <div class="two"><button type="button" class="big outline" onClick={onClose}>Cancel</button><button class="big" type="submit">Save</button></div>
        {onRemove && <button type="button" class="big danger" onClick={onRemove}>Delete this item</button>}
      </form>
    </div>
  );
}

export function ShareSheet({ link, onClose, onNewList, onBack }: { link: string; onClose: () => void; onNewList: () => void; onBack?: () => void }) {
  const [msg, setMsg] = useState("");
  const [sure, setSure] = useState(false);
  const svg = useMemo(() => { const q = qrcode(0, "M"); q.addData(link); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }, [link]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setMsg("Link copied"); } catch { setMsg("Press and hold the link to copy it"); }
  };
  const share = async () => {
    try { await navigator.share({ title: "Our grocery list", text: "Join our grocery list:", url: link }); } catch { /* cancelled */ }
  };
  const dlg = useDialog(onClose);
  return (
    <div class="sheet-bg" role="dialog" aria-modal="true" aria-labelledby="share-h" tabIndex={-1} ref={dlg.ref as never} onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={dlg.onKeyDown}>
      <div class="sheet">
        <h2 id="share-h">Share this list</h2>
        <p class="hint">Anyone with this link can see and change your list, like a spare house key. Share it only with people at home. No sign-up needed.</p>
        <p class="hint">Keep this link (send it to yourself). If your phone ever clears this app's data, opening the link brings your list back. Adding the app to your home screen helps your phone keep it.</p>
        <div class="qr" aria-label="QR code of the share link" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="share-link">{link}</p>
        <div class="two">
          <button class="big outline" onClick={copy}>Copy link</button>
          {"share" in navigator ? <button class="big" onClick={share}>Send…</button> : <button class="big" onClick={onClose}>Done</button>}
        </div>
        {msg && <p class="hint" role="status">{msg}</p>}
        {sure
          ? <button class="big danger" onClick={onNewList}>Yes, start a new empty list</button>
          : <button class="link" onClick={() => setSure(true)}>Start a new empty list on this phone</button>}
        {onBack && <button class="link" onClick={onBack}>Go back to my previous list</button>}
        <button class="link" onClick={onClose}>Close</button>
      </div>
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
