import { useMemo, useState } from "preact/hooks";
import qrcode from "qrcode-generator";
import { CATS, type Cat, type Item } from "../data/types";

export interface EditValues { name: string; cat: Cat; qty: number; unit: string }

export function EditSheet({ item, onSave, onRemove, onClose }: {
  item: Item | null; onSave: (v: EditValues) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [v, setV] = useState<EditValues>({ name: item?.name ?? "", cat: item?.cat ?? "Food & drinks", qty: item?.qty ?? 1, unit: item?.unit ?? "" });
  const set = (k: keyof EditValues) => (e: Event) => {
    const t = e.target as HTMLInputElement;
    setV({ ...v, [k]: k === "qty" ? Number(t.value) : t.value });
  };
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="sheet" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSave(v); }}>
        <h2>{item ? "Edit item" : "Add item"}</h2>
        <div class="field"><label for="f-name">Name</label><input id="f-name" value={v.name} onInput={set("name")} maxLength={40} required autoFocus={!item} /></div>
        <div class="field"><label for="f-cat">Kind</label>
          <select id="f-cat" value={v.cat} onChange={set("cat")}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div class="field-row">
          <div class="field"><label for="f-qty">How many at home?</label><input id="f-qty" type="number" min={0} max={999} inputMode="numeric" value={v.qty} onInput={set("qty")} /></div>
          <div class="field"><label for="f-unit">Unit</label><input id="f-unit" value={v.unit} onInput={set("unit")} maxLength={12} placeholder="packs, kg, sachets" /></div>
        </div>
        <div class="two"><button type="button" class="big outline" onClick={onClose}>Cancel</button><button class="big" type="submit">Save</button></div>
        {onRemove && <button type="button" class="big danger" onClick={onRemove}>Remove from app</button>}
      </form>
    </div>
  );
}

export function ShareSheet({ link, onClose, onNewList }: { link: string; onClose: () => void; onNewList: () => void }) {
  const [msg, setMsg] = useState("");
  const svg = useMemo(() => { const q = qrcode(0, "M"); q.addData(link); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }, [link]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setMsg("Link copied"); } catch { setMsg("Press and hold the link to copy it"); }
  };
  const share = async () => {
    try { await navigator.share({ title: "Our grocery list", text: "Join our grocery list:", url: link }); } catch { /* cancelled */ }
  };
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet">
        <h2>Share this list</h2>
        <p class="hint">Anyone with this link can see and change your list, like a spare house key. Share it only with people at home. No sign-up needed.</p>
        <div class="qr" aria-label="QR code of the share link" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="share-link">{link}</p>
        <div class="two">
          <button class="big outline" onClick={copy}>Copy link</button>
          {"share" in navigator ? <button class="big" onClick={share}>Send…</button> : <button class="big" onClick={onClose}>Done</button>}
        </div>
        {msg && <p class="hint" role="status">{msg}</p>}
        <button class="link" onClick={onNewList}>Start a new empty list on this phone</button>
        <button class="link" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function JoinSheet({ myCount, onJoin, onCancel }: { myCount: number; onJoin: (bring: boolean) => void; onCancel: () => void }) {
  return (
    <div class="sheet-bg">
      <div class="sheet">
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
