import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";

interface Props {
  children: ComponentChildren;
  onRight?: () => void; rightLabel?: string;
  onLeft?: () => void; leftLabel?: string;
}

/** Sideways swipe on a row. Vertical moves stay scrolls; buttons inside still get taps. */
export function Swipe({ children, onRight, rightLabel, onLeft, leftLabel }: Props) {
  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; id: number; mode: "?" | "x" | "no"; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || e.clientX < 24) { g.current = null; return; } // left edge = iPhone "back"
    g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: "?", moved: false };
  };
  const move = (e: PointerEvent) => {
    const s = g.current; if (!s || s.id !== e.pointerId || s.mode === "no") return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (s.mode === "?") {
      if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
      s.mode = Math.abs(x) > Math.abs(y) * 1.5 ? "x" : "no";
      if (s.mode === "no") return;
      box.current?.setPointerCapture(e.pointerId);
    }
    s.moved = true;
    setDx(x > 0 ? (onRight ? x : 0) : (onLeft ? x : 0));
  };
  const up = (e: PointerEvent) => {
    const s = g.current; g.current = null;
    if (!s || s.mode !== "x") return;
    const w = box.current?.offsetWidth ?? 300, x = e.clientX - s.x;
    setDx(0);
    if (x > w * 0.35 && onRight) onRight();
    else if (x < -w * 0.35 && onLeft) onLeft();
    if (s.moved) { // a swipe is not a tap
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      box.current?.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => box.current?.removeEventListener("click", stop, { capture: true }), 50);
    }
  };

  return (
    <div class="swipe" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { g.current = null; setDx(0); }}>
      {dx > 0 && <div class="swipe-bg right" aria-hidden="true">{rightLabel}</div>}
      {dx < 0 && <div class="swipe-bg left" aria-hidden="true">{leftLabel}</div>}
      <div class="swipe-row" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : undefined }}>{children}</div>
    </div>
  );
}
