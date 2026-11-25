import { useEffect, useRef, useState } from "preact/hooks";
import { APP_NAME } from "./config";
import { getHomeId, setHomeId, getPrevHomeId, newHomeId, shareLink, joinIdFromHash } from "./data/home";
import * as store from "./data/store";
import { lookupBarcode } from "./data/lookup";
import { pickIcon, type Item } from "./data/types";
import { AtHome } from "./screens/AtHome";
import { List } from "./screens/List";
import { Scan, type ScanResult } from "./screens/Scan";
import { EditSheet, ShareSheet, JoinSheet, type EditValues } from "./screens/Sheets";

type Tab = "home" | "scan" | "list";

export function App() {
  const [ready, setReady] = useState<"loading" | "ok" | "offline">("loading");
  const [home, setHome] = useState(() => getHomeId());
  const [items, setItems] = useState<Item[] | null>(null);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("home");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [joinId, setJoinId] = useState<string | null>(() => joinIdFromHash(location.hash));
  const [toast, setToast] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const say = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(""), 2400); };
  const fail = () => say("Couldn't save that change. Try again.");

  const boot = () => {
    setReady("loading");
    store.initStore().then(() => setReady("ok"), () => setReady("offline"));
  };
  useEffect(boot, []);

  useEffect(() => {
    if (ready !== "ok") return;
    setItems(null);
    const off = store.watchSizes(home, setSizes);
    const offItems = store.watchItems(home, setItems, () => say("Couldn't load your list."));
    return () => { off(); offItems(); };
  }, [ready, home]);

  useEffect(() => {
    const onHash = () => setJoinId(joinIdFromHash(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);

  if (ready !== "ok") {
    return (
      <div class="center">
        {ready === "loading" ? <p>Opening your list…</p> : <>
          <h1>{APP_NAME}</h1>
          <p>Connect to the internet once to set up. After that the app works offline too.</p>
          <button class="big" onClick={boot}>Try again</button>
        </>}
      </div>
    );
  }

  const list = items ?? [];
  const toBuy = list.filter((i) => i.onList && !i.inBasket).length;
  const title = tab === "home" ? "At Home" : tab === "scan" ? "Scan" : "Shopping List";

  const resolve = async (code: string): Promise<ScanResult> => {
    const saved = await store.getSavedProduct(home, code);
    if (saved) return { code, product: saved, source: "home" };
    const found = await lookupBarcode(code);
    return { code, product: found, source: found ? "db" : null };
  };

  const onScanAdd = (r: ScanResult, name: string, where: "home" | "list") => {
    const cat = r.product?.cat ?? "Other";
    const icon = pickIcon(name, cat);
    if (r.source !== "home") store.saveProduct(home, r.code, { name, cat, icon, size: r.product?.size ?? "" }, fail);
    const t = { name, cat, icon, barcode: r.code };
    if (where === "home") { store.addToHome(home, list, t, fail); say(`${name} added to At Home`); }
    else { store.addToList(home, list, t, fail); say(`${name} added to your list`); }
  };

  const saveEdit = (v: EditValues) => {
    if (edit === "new") {
      if (v.qty > 0) store.addToHome(home, list, { name: v.name, cat: v.cat, unit: v.unit }, fail, v.qty);
      else store.addToList(home, list, { name: v.name, cat: v.cat, unit: v.unit }, fail);
      say(`${v.name.trim()} added`);
    } else if (edit) { store.editItem(home, edit, v, fail); say("Saved"); }
    setEdit(null);
  };

  const join = (bring: boolean) => {
    if (!joinId) return;
    // Not awaited: offline writes only resolve once the server confirms them.
    if (bring && list.length) store.copyItems(joinId, list).catch(() => say("Couldn't bring your items. Your old list is still under \"Go back\" in Share list."));
    setHomeId(joinId); setHome(joinId); setJoinId(null); clearHash(); setTab("list");
    say("You're now on the shared list");
  };

  return (
    <div class="app">
      <header class="top">
        <h1>{title}</h1>
        <button class="top-btn" onClick={() => setSharing(true)}>Share list</button>
      </header>
      <main class="view">
        {items === null ? <p class="count">Loading…</p>
          : tab === "home" ? <AtHome items={list} sizes={sizes}
              onInc={(i) => store.changeQty(home, i, 1, fail)}
              onDec={(i) => { if (i.qty <= 1) say(`${i.name} added to your list`); store.changeQty(home, i, -1, fail); }}
              onOut={(i) => { store.ranOut(home, i, fail); say(`${i.name} added to your list`); }}
              onEdit={(i) => setEdit(i)} onAdd={() => setEdit("new")} />
          : tab === "scan" ? <Scan resolve={resolve} onAdd={onScanAdd} onManual={() => setEdit("new")} />
          : <List items={list} sizes={sizes}
              onAdd={(name, icon) => { store.addToList(home, list, { name, icon, cat: icon ? "Food & drinks" : "Other" }, fail); }}
              onTick={(i, v) => store.setInBasket(home, i, v, fail)}
              onPutAway={(b) => { store.putAway(home, b, fail); say(`${b.length} ${b.length === 1 ? "item" : "items"} put away`); }} />}
      </main>
      <nav class="nav" aria-label="Tabs">
        <button class="tab" aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><span class="ic">🏠</span>At Home</button>
        <button class="tab scan" aria-current={tab === "scan" ? "page" : undefined} onClick={() => setTab("scan")}><span class="ic">▥</span>Scan</button>
        <button class="tab" aria-current={tab === "list" ? "page" : undefined} onClick={() => setTab("list")}><span class="ic">🛒</span>List{toBuy > 0 && <span class="dot">{toBuy}</span>}</button>
      </nav>
      {edit && <EditSheet item={edit === "new" ? null : edit} onSave={saveEdit} onClose={() => setEdit(null)}
        onRemove={edit === "new" ? undefined : () => { store.removeItem(home, edit, fail); setEdit(null); say("Removed"); }} />}
      {sharing && <ShareSheet link={shareLink(home)} onClose={() => setSharing(false)}
        onNewList={() => { const id = newHomeId(); setHomeId(id); setHome(id); setSharing(false); say("New empty list started"); }}
        onBack={getPrevHomeId() ? () => { const id = getPrevHomeId()!; setHomeId(id); setHome(id); setSharing(false); say("Back on your previous list"); } : undefined} />}
      {joinId && joinId !== home && <JoinSheet myCount={list.length} onJoin={join} onCancel={() => { setJoinId(null); clearHash(); }} />}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}
