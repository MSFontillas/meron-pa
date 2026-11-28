import { useState } from "preact/hooks";
import { useDialog } from "./useDialog";
import { checkToken } from "../admin/github";
import { CATALOG_REPO } from "../config";

/** Admin only: connect a GitHub token, see what is waiting to go into the shared catalog, send it. */
export function AdminSheet({ connected, waiting, onConnect, onSend, onSignOut, onClose }: {
  connected: boolean; waiting: number;
  onConnect: (token: string) => void; onSend: () => Promise<string>; onSignOut: () => void; onClose: () => void;
}) {
  const dlg = useDialog(onClose);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<string>) => { setBusy(true); setMsg(""); setMsg(await f()); setBusy(false); };
  const connect = () => run(async () => {
    const t = token.trim(), r = await checkToken(t);
    if (!r.ok) return r.why;
    setToken(""); onConnect(t); return "Connected.";
  });
  return (
    <div class="sheet-bg" role="dialog" aria-modal="true" aria-labelledby="admin-h" tabIndex={-1} ref={dlg.ref as never} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="sheet" onSubmit={(e) => { e.preventDefault(); if (!connected && token.trim()) connect(); }}>
        <h2 id="admin-h">Admin</h2>
        {connected ? (
          <>
            <p class="hint">Connected to {CATALOG_REPO}. Products you name while scanning are added to the shared catalog.</p>
            <p class="hint" role="status">{waiting ? `${waiting} ${waiting === 1 ? "product" : "products"} waiting to be added.` : "Nothing waiting."} {msg}</p>
            <button class="big" type="button" disabled={busy || !waiting} onClick={() => run(onSend)}>Send now</button>
            <button class="big outline" type="button" onClick={() => { onSignOut(); onClose(); }}>Sign out of admin</button>
          </>
        ) : (
          <>
            <p class="hint">Paste a GitHub fine-grained token for {CATALOG_REPO} with Contents: Read and write. It stays on this phone only.</p>
            <div class="field"><label for="a-token">Token</label>
              <input id="a-token" type="password" autocomplete="off" value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} /></div>
            <p class="hint" role="status">{msg}</p>
            <button class="big" type="submit" disabled={busy || !token.trim()}>Connect</button>
          </>
        )}
        <button class="big outline" type="button" onClick={onClose}>Close</button>
      </form>
    </div>
  );
}
