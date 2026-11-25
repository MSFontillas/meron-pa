import { useEffect, useRef, useState } from "preact/hooks";
import { catClass, pickIcon, type Item, type Product } from "../data/types";
import { findSame } from "../data/store";

export interface ScanResult { code: string; product: Product | null; source: "home" | "db" | null }
export type Where = "home" | "list";
interface Props {
  items: Item[];
  resolve: (code: string) => Promise<ScanResult>;
  onAdd: (r: ScanResult, name: string, where: Where) => void;
  onManual: () => void;
}

const MODE_KEY = "scanMode";
const savedMode = (): Where => { try { return localStorage.getItem(MODE_KEY) === "list" ? "list" : "home"; } catch { return "home"; } };

/** Pending = a scan that needs the user: a name for a new product, or "you still have some". */
type Pending = { r: ScanResult; kind: "name" } | { r: ScanResult; kind: "have"; qty: number };

export function Scan({ items, resolve, onAdd, onManual }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [cam, setCam] = useState<"starting" | "on" | "error">("starting");
  const [err, setErr] = useState("");
  const [mode, setModeState] = useState<Where>(savedMode);
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // The scanner callback outlives renders: read the latest values through refs.
  const live = useRef({ mode, items, pending, busy, onAdd, resolve });
  live.current = { mode, items, pending, busy, onAdd, resolve };

  const alive = useRef(true);
  const stop = () => { stopRef.current?.(); stopRef.current = null; };
  useEffect(() => { void start(); return () => { alive.current = false; stop(); }; }, []); // camera opens on its own

  const setMode = (m: Where) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* not remembered */ } };

  async function onCode(code: string) {
    if (live.current.busy || live.current.pending) return; // one thing at a time
    setBusy(true);
    const r = await live.current.resolve(code);
    setBusy(false);
    if (!alive.current) return;
    const { mode: m, items: xs } = live.current;
    if (!r.product) { setName(""); setPending({ r, kind: "name" }); return; }
    const have = findSame(xs, r.product.name, r.code);
    if (m === "list" && have && have.qty > 0) { setPending({ r, kind: "have", qty: have.qty }); return; }
    navigator.vibrate?.(40);
    live.current.onAdd(r, r.product.name, m);
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

  const finish = (add: boolean) => {
    if (pending && add) {
      const n = pending.kind === "name" ? name.trim() : pending.r.product!.name;
      if (!n) return;
      onAdd(pending.r, n, mode);
    }
    setPending(null);
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

      <div class="scan-foot">
        <p class="mode-h" id="mode-h">Scanned items go to</p>
        <div class="mode" role="group" aria-labelledby="mode-h">
          <button aria-pressed={mode === "home"} onClick={() => setMode("home")}><span aria-hidden="true">🏠</span> At Home</button>
          <button aria-pressed={mode === "list"} onClick={() => setMode("list")}><span aria-hidden="true">🛒</span> List</button>
        </div>
        <button class="link" onClick={onManual}>No barcode? Add it by hand</button>
      </div>
    </>
  );
}
