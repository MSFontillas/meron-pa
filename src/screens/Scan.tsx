import { useEffect, useRef, useState } from "preact/hooks";
import { CATS, catClass, parsePeso, peso, pesoInput, pickIcon, priceAge, type Item, type Product } from "../data/types";
import { findSame } from "../data/store";
import { checkRow, type CatalogRow } from "../data/catalogRows";

export interface ScanResult { code: string; product: Product | null; source: "home" | "catalog" | "db" | null }
export type Where = "home" | "list";
interface Props {
  items: Item[];
  resolve: (code: string) => Promise<ScanResult>;
  onAdd: (r: ScanResult, name: string, where: Where, price?: number) => void;
  onManual: () => void;
  admin?: boolean; // the admin's phone: names typed here can also go into the shared catalog
  onCatalog?: (row: CatalogRow) => void;
}

const MODE_KEY = "scanMode";
const savedMode = (): Where => { try { return localStorage.getItem(MODE_KEY) === "list" ? "list" : "home"; } catch { return "home"; } };

const ASK_KEY = "askPrice";
const savedAsk = (): boolean => { try { return localStorage.getItem(ASK_KEY) === "1"; } catch { return false; } };

/** Pending = a scan that needs the user: a name for a new product, "you still have some", or a price. */
type Pending = { r: ScanResult; kind: "name" } | { r: ScanResult; kind: "have"; qty: number } | { r: ScanResult; kind: "price" } | { r: ScanResult; kind: "fix" };

export function Scan({ items, resolve, onAdd, onManual, admin, onCatalog }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [cam, setCam] = useState<"starting" | "on" | "error">("starting");
  const [err, setErr] = useState("");
  const [mode, setModeState] = useState<Where>(savedMode);
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAskState] = useState(savedAsk);
  const [priceText, setPriceText] = useState("");
  const [priceErr, setPriceErr] = useState(false);
  const [from, setFrom] = useState<ScanResult["source"]>(null);
  // Admin only: how a new or fixed product is described for the shared catalog.
  const [aKind, setAKind] = useState<string>(CATS[0]);
  const [aSize, setASize] = useState("");
  const [aCat, setACat] = useState(true);
  const [aGive, setAGive] = useState(true);
  const [aErr, setAErr] = useState("");
  const [last, setLast] = useState<ScanResult | null>(null); // the last scanned product, so the admin can fix its catalog entry

  // The scanner callback outlives renders: read the latest values through refs.
  const live = useRef({ mode, items, pending, busy, ask, onAdd, resolve });
  live.current = { mode, items, pending, busy, ask, onAdd, resolve };

  const alive = useRef(true);
  const stop = () => { stopRef.current?.(); stopRef.current = null; };
  useEffect(() => { void start(); return () => { alive.current = false; stop(); }; }, []); // camera opens on its own

  const setMode = (m: Where) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* not remembered */ } };

  const setAsk = (v: boolean) => { setAskState(v); try { localStorage.setItem(ASK_KEY, v ? "1" : "0"); } catch { /* not remembered */ } };

  /** Asks for a price (pre-filled with the last one) when the tick box is on; otherwise adds at once. */
  function addOrAsk(r: ScanResult, name: string, m: Where) {
    if (!live.current.ask) { navigator.vibrate?.(40); live.current.onAdd(r, name, m); return; }
    const last = findSame(live.current.items, name, r.code)?.price;
    setPriceText(last ? pesoInput(last) : ""); setPriceErr(false);
    setPending({ r, kind: "price" });
  }

  async function onCode(code: string) {
    if (live.current.busy || live.current.pending) return; // one thing at a time
    setBusy(true);
    const r = await live.current.resolve(code);
    setBusy(false);
    if (!alive.current) return;
    setFrom(r.source);
    if (r.product) setLast(r);
    const { mode: m, items: xs } = live.current;
    if (!r.product) { setName(""); setPriceText(""); setPriceErr(false); setASize(""); setAKind(CATS[0]); setAErr(""); setPending({ r, kind: "name" }); return; }
    const have = findSame(xs, r.product.name, r.code);
    if (m === "list" && have && have.qty > 0) { setPending({ r, kind: "have", qty: have.qty }); return; }
    addOrAsk(r, r.product.name, m);
  }

  async function start() {
    setCam("starting");
    try {
      const { startScanner } = await import("../scan/scanner");
      const s = await startScanner(video.current!, (c) => void onCode(c));
      if (!alive.current) return s(); // user left the Scan tab while the camera was starting
      stopRef.current = s; setCam("on");
    } catch (e) {
      setErr(e === "denied" ? "Camera access was blocked. Allow the camera for this app in your phone's settings, then try again."
        : "No camera found. You can still add things by hand.");
      setCam("error");
    }
  }

  /** Adds with the typed price (empty = no price). Keeps the card open on a price it can't read. */
  const commit = (r: ScanResult, n: string, withPrice: boolean) => {
    const typed = priceText.trim();
    const price = withPrice && typed ? parsePeso(typed) : undefined;
    if (withPrice && typed && price === null) { setPriceErr(true); return; }
    onAdd(r, n, mode, price ?? undefined);
    setPending(null);
  };
  const finish = (add: boolean) => {
    if (!pending) return;
    if (!add) { setPending(null); return; }
    if (pending.kind === "name") {
      const n = name.trim(); if (!n) return;
      if (!admin) { commit(pending.r, n, live.current.ask); return; }
      const row: CatalogRow = { code: pending.r.code, name: n, brand: "", size: aSize.trim(), kind: aKind, giveBack: aGive };
      const bad = aCat ? checkRow(row) : "";
      if (bad) { setAErr(bad); return; }
      if (aCat) onCatalog?.(row);
      // the household gets the same kind and size the catalog gets
      commit({ ...pending.r, product: { name: n, cat: aKind as (typeof CATS)[number], icon: pickIcon(n, aKind as (typeof CATS)[number]), size: aSize.trim() } }, n, live.current.ask);
    }
    else if (pending.kind === "fix") {
      const n = name.trim(), row: CatalogRow = { code: pending.r.code, name: n, brand: "", size: aSize.trim(), kind: aKind, giveBack: false };
      const bad = checkRow(row);
      if (bad) { setAErr(bad); return; }
      onCatalog?.(row); setPending(null);
    }
    else if (pending.kind === "have") { setPending(null); addOrAsk(pending.r, pending.r.product!.name, mode); }
    else commit(pending.r, pending.r.product!.name, true);
  };
  const p = pending?.r.product;

  return (
    <>
      <div class={pending ? "cam small" : "cam"}>
        <video ref={video} hidden={cam !== "on"} />
        {cam === "on" && <div class="frame" aria-hidden="true" />}
        {cam !== "on" && <p class="cam-msg">{cam === "error" ? err : "Opening the camera…"}</p>}
        {busy && <p class="cam-busy" role="status">Looking it up…</p>}
      </div>
      {cam === "error" && <button class="big" onClick={start}>Try again</button>}

      {pending?.kind === "name" && (
        <div class="result">
          <div class="result-top">
            <span class="pic" aria-hidden="true">📦</span>
            <div><h3>New product</h3><p class="meta">Type its name once. Next time it's found instantly.</p></div>
          </div>
          <input class="new-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. Ube jam" aria-label="Product name" maxLength={40} />
          {admin && <AdminFields kind={aKind} size={aSize} err={aErr} onKind={setAKind} onSize={setASize} />}
          {admin && (
            <>
              <label class="ask"><input type="checkbox" checked={aCat} onChange={(e) => setACat((e.target as HTMLInputElement).checked)} /> Add to the shared catalog</label>
              <label class="ask"><input type="checkbox" checked={aGive} disabled={!aCat} onChange={(e) => setAGive((e.target as HTMLInputElement).checked)} /> Offer to Open Food Facts</label>
            </>
          )}
          {ask && <PriceBox id="pr-new" text={priceText} err={priceErr} onInput={(t) => { setPriceText(t); setPriceErr(false); }} onEnter={() => finish(true)} />}
          <button class="big" disabled={!name.trim()} onClick={() => finish(true)}>Add to {mode === "home" ? "At Home" : "List"}</button>
          <button class="link" onClick={() => finish(false)}>Cancel</button>
        </div>
      )}
      {pending?.kind === "have" && p && (
        <div class="result" role="alertdialog" aria-labelledby="have-h">
          <div class="result-top">
            <span class={`pic ${catClass(p.cat)}`} aria-hidden="true">{pickIcon(p.name, p.cat)}</span>
            <div><h3 id="have-h">You still have {pending.qty} {p.name}</h3><p class="meta">Add it to your shopping list anyway?</p></div>
          </div>
          <div class="two">
            <button class="big" onClick={() => finish(true)}>Add to List</button>
            <button class="big outline" onClick={() => finish(false)}>No</button>
          </div>
        </div>
      )}

      {pending?.kind === "price" && p && (
        <form class="result" onSubmit={(e) => { e.preventDefault(); finish(true); }}>
          <div class="result-top">
            <span class={`pic ${catClass(p.cat)}`} aria-hidden="true">{pickIcon(p.name, p.cat)}</span>
            <div><h3>{p.name}</h3><p class="meta">{(() => { const it = findSame(items, p.name, pending.r.code); return it?.price && it.priceAt ? `Last price ${peso(it.price)}, ${priceAge(it.priceAt)}` : "No price saved yet"; })()}</p></div>
          </div>
          <PriceBox id="pr" text={priceText} err={priceErr} focus onInput={(t) => { setPriceText(t); setPriceErr(false); }} />
          <div class="two">
            <button class="big" type="submit">Save price</button>
            <button class="big outline" type="button" onClick={() => { onAdd(pending.r, p.name, mode); setPending(null); }}>Skip</button>
          </div>
        </form>
      )}

      {pending?.kind === "fix" && (
        <form class="result" onSubmit={(e) => { e.preventDefault(); finish(true); }}>
          <div class="result-top"><span class="pic" aria-hidden="true">✏️</span><div><h3>Fix in catalog</h3><p class="meta">Barcode {pending.r.code}. Saved for everyone after the next update.</p></div></div>
          <input class="new-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} aria-label="Product name" maxLength={40} />
          <AdminFields kind={aKind} size={aSize} err={aErr} onKind={setAKind} onSize={setASize} />
          <div class="two"><button class="big" type="submit" disabled={!name.trim()}>Save to catalog</button><button class="big outline" type="button" onClick={() => setPending(null)}>Cancel</button></div>
        </form>
      )}
      {admin && !pending && last?.product && (
        <button class="link" onClick={() => { setName(last.product!.name); setASize(last.product!.size); setAKind(last.product!.cat); setAErr(""); setPending({ r: last, kind: "fix" }); }}>Fix in catalog: {last.product.name}</button>
      )}

      <div class={pending ? "scan-foot flow" : "scan-foot"}>
        <p class="mode-h" id="mode-h">Scanned items go to</p>
        <div class="mode" role="group" aria-labelledby="mode-h">
          <button aria-pressed={mode === "home"} onClick={() => setMode("home")}><span aria-hidden="true">🏠</span> At Home</button>
          <button aria-pressed={mode === "list"} onClick={() => setMode("list")}><span aria-hidden="true">🛒</span> List</button>
        </div>
        {from === "catalog" && <p class="meta" role="status">From the Meron Pa? catalog</p>}
        <label class="ask"><input type="checkbox" checked={ask} onChange={(e) => setAsk((e.target as HTMLInputElement).checked)} /> Ask for price on each scan</label>
        <button class="link" onClick={onManual}>No barcode? Add it by hand</button>
        <p class="meta">Product data: <a href="https://github.com/MSFontillas/meron-pa/blob/main/data/README.md" target="_blank" rel="noopener noreferrer">Open Food Facts contributors (ODbL) and Meron Pa?</a></p>
      </div>
    </>
  );
}

function PriceBox({ id, text, err, focus, onInput, onEnter }: { id: string; text: string; err: boolean; focus?: boolean; onInput: (t: string) => void; onEnter?: () => void }) {
  return (
    <div class="field">
      <label for={id}>Price (₱){focus ? "" : ", optional"}</label>
      <input id={id} class="new-name" value={text} inputMode="decimal" placeholder="e.g. 45.50" maxLength={10} autoFocus={focus}
        aria-invalid={err} aria-describedby={err ? id + "-err" : undefined}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }} />
      {err && <small id={id + "-err"} class="hint" role="alert">That doesn't look like a price. Use numbers like 45 or 45.50.</small>}
    </div>
  );
}

function AdminFields({ kind, size, err, onKind, onSize }: { kind: string; size: string; err: string; onKind: (k: string) => void; onSize: (s: string) => void }) {
  return (
    <div class="field-row">
      <div class="field"><label for="a-kind">Kind</label>
        <select id="a-kind" value={kind} onChange={(e) => onKind((e.target as HTMLSelectElement).value)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      <div class="field"><label for="a-size">Size, optional</label>
        <input id="a-size" value={size} onInput={(e) => onSize((e.target as HTMLInputElement).value)} maxLength={30} placeholder="e.g. 150 g" aria-invalid={!!err} />
        {err && <small class="hint" role="alert">{err}</small>}</div>
    </div>
  );
}
