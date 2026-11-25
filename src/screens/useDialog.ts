import { useLayoutEffect, useRef } from "preact/hooks";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The page behind a dialog is made inert, which blurs the opener before the dialog mounts; so remember the last focused element ourselves.
let lastFocus: HTMLElement | null = null;
if (typeof document !== "undefined") document.addEventListener("focusin", (e) => { const t = e.target as HTMLElement; if (!t.closest?.("[role=dialog]")) lastFocus = t; });

/** Dialog behaviour: focus moves in on open and returns to the opener on close; Tab stays inside; Escape closes. */
export function useDialog(onClose?: () => void) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => { // before paint, so focus and key handling are in place as soon as the dialog shows
    const back = lastFocus;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current; if (!box) return;
      if (e.key === "Escape" && close.current) { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab") return;
      const f = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      else if (!box.contains(a)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); setTimeout(() => back?.focus?.(), 0); /* after the page behind is no longer inert */ };
  }, []);
  return { ref };
}
