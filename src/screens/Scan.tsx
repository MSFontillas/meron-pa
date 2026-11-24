import { useEffect, useRef, useState } from "preact/hooks";
import type { Product } from "../data/types";

export interface ScanResult { code: string; product: Product | null; source: "home" | "db" | null }
interface Props {
  resolve: (code: string) => Promise<ScanResult>;
  onAdd: (r: ScanResult, name: string, where: "home" | "list") => void;
  onManual: () => void;
}

export function Scan({ resolve, onAdd, onManual }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "looking" | "result" | "error">("idle");
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ScanResult | null>(null);
  const [name, setName] = useState("");

  const alive = useRef(true);
  const stop = () => { stopRef.current?.(); stopRef.current = null; };
  useEffect(() => () => { alive.current = false; stop(); }, []);

  async function start() {
    setRes(null); setName(""); setState("scanning");
    try {
      const { startScanner } = await import("../scan/scanner");
      const s = await startScanner(video.current!, async (code) => {
        setState("looking");
        const r = await resolve(code);
        setRes(r); setName(r.product?.name ?? ""); setState("result");
      });
      if (!alive.current) return s(); // user left the Scan tab while the camera was starting
      stopRef.current = s;
    } catch (e) {
      setErr(e === "denied" ? "Camera access was blocked. Allow the camera for this app in your phone's settings, then try again."
        : "No camera found. You can still add things by hand.");
      setState("error");
    }
  }

  const add = (where: "home" | "list") => { if (res && name.trim()) { onAdd(res, name, where); setRes(null); setState("idle"); } };
  return (
    <>
      <div class="cam">
        <video ref={video} hidden={state !== "scanning"} />
        {state === "scanning" && <div class="frame" aria-hidden="true" />}
        {state !== "scanning" && <p class="cam-msg">{state === "looking" ? "Looking it up…" : state === "error" ? err : "Point the camera at a barcode"}</p>}
      </div>
      {res && state === "result" ? (
        <div class="result">
          <div class="result-top">
            <span class="pic" aria-hidden="true">{res.product?.icon ?? "📦"}</span>
            <div>
              {res.product ? <h3>{res.product.name}</h3> : <h3>New product</h3>}
              <p class="meta">{res.product ? `${res.product.size ? res.product.size + " · " : ""}${res.source === "home" ? "Named by your home before" : "Found in a product database"}` : "Not in any database yet. Type its name once; next time it's found instantly."}</p>
              <p class="meta">Barcode {res.code}</p>
            </div>
          </div>
          {!res.product && <input class="new-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. Ube jam" aria-label="Product name" maxLength={40} />}
          <div class="two">
            <button class="big" disabled={!name.trim()} onClick={() => add("home")}>Add to At Home</button>
            <button class="big outline" disabled={!name.trim()} onClick={() => add("list")}>Add to List</button>
          </div>
          <button class="link" onClick={start}>Scan another</button>
        </div>
      ) : state !== "scanning" && state !== "looking" ? (
        <button class="big" onClick={start}>Scan barcode</button>
      ) : (
        <button class="big outline" onClick={() => { stop(); setState("idle"); }}>Stop</button>
      )}
      <button class="link" onClick={onManual}>No barcode? Add it by hand</button>
    </>
  );
}
