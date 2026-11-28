import { useMemo, useState } from "preact/hooks";
import { useDialog } from "./useDialog";
import qrcode from "qrcode-generator";

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
    <div class="sheet-bg" role="dialog" aria-modal="true" aria-labelledby="share-h" tabIndex={-1} ref={dlg.ref as never} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
