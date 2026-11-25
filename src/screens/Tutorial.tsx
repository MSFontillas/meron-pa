import { useState } from "preact/hooks";

const KEY = "tutorialSeen";
export function tutorialSeen(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } }

const STEPS: [string, string, string][] = [
  ["▥", "Scan what you buy", "Open Scan and the camera starts by itself. Point it at a barcode. New product? Type its name once and the app remembers it."],
  ["🏠", "At Home", "Tap + or − to change how many you have. Swipe right when it ran out: it goes on your shopping list. Swipe left to delete."],
  ["🛒", "Shopping List", "Tap an item to put it in your basket; tap again to take it out. At home, tap \"Put away\". Swipe right to take an item off the list."],
  ["↩️", "Made a mistake?", "Every swipe shows a message with Undo. Tap it to bring the item back."],
  ["👨‍👩‍👧", "Share with your household", "Tap \"Share list\" and send the link. Everyone sees the same list. No sign-up."],
];

export function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const done = () => { try { localStorage.setItem(KEY, "1"); } catch { /* shows again next time */ } onDone(); };
  const [ic, title, text] = STEPS[i], last = i === STEPS.length - 1;
  return (
    <div class="sheet-bg tut-bg" role="dialog" aria-modal="true" aria-labelledby="tut-h">
      <div class="tut">
        <span class="tut-ic" aria-hidden="true">{ic}</span>
        <h2 id="tut-h">{title}</h2>
        <p>{text}</p>
        <div class="tut-dots" aria-label={`Step ${i + 1} of ${STEPS.length}`}>{STEPS.map((_, k) => <span class={k === i ? "on" : ""} />)}</div>
        <button class="big" onClick={() => (last ? done() : setI(i + 1))}>{last ? "Start" : "Next"}</button>
        {!last && <button class="link" onClick={done}>Skip</button>}
      </div>
    </div>
  );
}
