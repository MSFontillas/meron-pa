import { useEffect, useRef, useState } from "preact/hooks";
import { catClass, parsePeso, peso, pesoInput, pickIcon, priceAge, type Item, type Product } from "../data/types";
import { findSame } from "../data/store";

export interface ScanResult { code: string; product: Product | null; source: "home" | "catalog" | "db" | null }
export type Where = "home" | "list";
interface Props {
  items: Item[];
  resolve: (code: string) => Promise<ScanResult>;
  onAdd: (r: ScanResult, name: string, where: Where, price?: number) => void;
  onManual: () => void;
}

const MODE_KEY = "scanMode";
const savedMode = (): Where => { try { return localStorage.getItem(MODE_KEY) === "list" ? "list" : "home"; } catch { return "home"; } };

const ASK_KEY = "askPrice";
const savedAsk = (): boolean => { try { return localStorage.getItem(ASK_KEY) === "1"; } catch { return false; } };

/** Pending = a scan that needs the user: a name for a new product, "you still have some", or a price. */
type Pending = { r: ScanResult; kind: "name" } | { r: ScanResult; kind: "have"; qty: number } | { r: ScanResult; kind: "price" };

export function Scan({ items, resolve, onAdd, onManual }: Props) {
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
    const { mode: m, items: xs } = live.current;
    if (!r.product) { setName(""); setPriceText(""); setPriceErr(false); setPending({ r, kind: "name" }); return; }
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
    if (pending.kind === "name") { const n = name.trim(); if (n) commit(pending.r, n, live.current.ask); }
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
