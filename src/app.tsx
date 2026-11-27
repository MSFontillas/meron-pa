import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { APP_NAME } from "./config";
import { isFreshHome, getHomeId, setHomeId, getPrevHomeId, newHomeId, shareLink, joinIdFromHash } from "./data/home";
import * as store from "./data/store";
import { codeVariants, lookupBarcode } from "./data/lookup";
import { toggleTheme } from "./theme";
import { within } from "./data/net";
import { prefetchDecoder } from "./scan/prefetch";
import { parsePeso, peso, pickIcon, type Item, type Product } from "./data/types";
import { AtHome } from "./screens/AtHome";
import { List } from "./screens/List";
import { Scan, type ScanResult, type Where } from "./screens/Scan";
import { Tutorial, tutorialSeen } from "./screens/Tutorial";
import { StockCheck } from "./screens/StockCheck";
import { EditSheet, ShareSheet, JoinSheet, type EditValues } from "./screens/Sheets";

type Tab = "home" | "scan" | "list";

export function App() {
  const [ready, setReady] = useState<"loading" | "ok" | "offline">("loading");
  const [home, setHome] = useState(() => getHomeId());
  const [items, setItems] = useState<Item[] | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches));
  const [products, setProducts] = useState<Record<string, Product> | null>(null);
  const sizes = useMemo(() => Object.fromEntries(Object.entries(products ?? {}).filter(([, p]) => p.size).map(([c, p]) => [c, p.size])), [products]);
  const [tab, setTab] = useState<Tab>("home");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [joinId, setJoinId] = useState<string | null>(() => joinIdFromHash(location.hash));
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [checking, setChecking] = useState(false);
  const [tutorial, setTutorial] = useState(() => !tutorialSeen());
  const timer = useRef<number | undefined>(undefined);

  const say = (msg: string, undo?: () => void) => {
    setToast({ msg, undo }); clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 8000 : 2400);
  };
  // Every swipe can be taken back: the item is written back exactly as it was.
  const undoable = (i: Item, msg: string) => say(msg, () => { store.restore(home, i, fail); setToast(null); });
  const fail = () => say("Couldn't save that change. Try again.");

  const boot = () => {
    setReady("loading");
    within(store.initStore(), 12000).then(() => setReady("ok"), () => setReady("offline"));
  };
  useEffect(boot, []);
  useEffect(() => { if (ready === "ok") prefetchDecoder(); }, [ready]);

  useEffect(() => {
    if (ready !== "ok") return;
    setItems(isFreshHome(home) ? [] : null);
    setProducts(null);
    const off = store.watchProducts(home, setProducts);
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
          <p>Can't reach the list service. Check your internet, and turn off any content blocker for this site. You only need to connect once; after that the app works offline too.</p>
          <button class="big" onClick={boot}>Try again</button>
        </>}
      </div>
    );
  }

  const list = items ?? [];
  const toBuy = list.filter((i) => i.onList && !i.inBasket).length;
  const title = tab === "home" ? "At Home" : tab === "scan" ? "Scan" : "Shopping List";

  const resolve = async (code: string): Promise<ScanResult> => {
    // Named by this household before: answer from memory at once (network read only if not loaded yet).
    const saved = products ? codeVariants(code).map((c) => products[c]).find(Boolean) ?? null : await store.getSavedProduct(home, code);
    if (saved) return { code, product: saved, source: "home" };
    const found = await lookupBarcode(code);
    return { code, product: found, source: found ? "db" : null };
  };

  const onScanAdd = (r: ScanResult, name: string, where: Where, price?: number) => {
    const cat = r.product?.cat ?? "Other";
    const icon = pickIcon(name, cat);
    if (r.source !== "home") store.saveProduct(home, r.code, { name, cat, icon, size: r.product?.size ?? "" }, fail);
    const t = { name, cat, icon, barcode: r.code, price };
    const prev = store.findSame(list, name, r.code);
    const id = where === "home" ? store.addToHome(home, list, t, fail) : store.addToList(home, list, t, fail);
    const back = () => { if (prev) store.restore(home, prev, fail); else store.removeItem(home, { id }, fail); setToast(null); };
    const cost = price ? ` · ${peso(price)}` : "";
    say(where === "home" ? `${name} +1 At Home${prev?.onList ? ", off your list" : ""}${cost}` : `${name} added to your list${cost}`, back);
  };

  const saveEdit = (v: EditValues) => {
    const typed = v.price.trim();
    const price = typed === "" ? null : parsePeso(typed);
    if (typed !== "" && price === null) { say("That price doesn't look right. Use numbers like 45 or 45.50."); return; }
    if (edit === "new") {
      const t = { name: v.name, cat: v.cat, unit: v.unit, want: v.want, price: price ?? undefined };
      if (v.qty > 0) store.addToHome(home, list, t, fail, v.qty);
      else store.addToList(home, list, t, fail);
      say(`${v.name.trim()} added`);
    } else if (edit) { store.editItem(home, edit, { ...v, price }, fail); say("Saved"); }
    setEdit(null);
  };

  const join = (bring: boolean) => {
    if (!joinId) return;
    // Not awaited: offline writes only resolve once the server confirms them.
    if (bring && list.length) store.copyItems(joinId, list).catch(() => say("Couldn't bring your items. Your old list is still under \"Go back\" in Share list."));
    setHomeId(joinId); setHome(joinId); setJoinId(null); clearHash(); setTab("list");
    say("You're now on the shared list");
  };

  // Behind a dialog nothing can be reached by keyboard or screen reader.
  const modal = !!(edit || sharing || checking || (joinId && joinId !== home) || tutorial);
  const bg = modal ? { inert: true } : {};
  return (
    <div class="app">
      <header class="top" {...bg}>
        <h1>{title}</h1>
        <div class="top-row">
          <button class="theme-btn" aria-label="Switch light or dark mode" onClick={() => setIsDark(toggleTheme())}>{isDark ? "☀️" : "🌙"}</button>
          <button class="top-btn" onClick={() => setSharing(true)}>Share list</button>
        </div>
      </header>
      <main class={tab === "scan" ? "view scan-view" : "view"} {...bg}>
        {items === null ? <p class="count">Loading…</p>
          : tab === "home" ? <AtHome items={list} sizes={sizes}
              onInc={(i) => store.changeQty(home, i, 1, fail)}
              onDec={(i) => { if (i.qty <= 1) say(`${i.name} added to your list`); store.changeQty(home, i, -1, fail); }}
              onOut={(i) => { store.ranOut(home, i, fail); undoable(i, `${i.name} ran out, added to your list`); }}
              onDelete={(i) => { store.removeItem(home, i, fail); undoable(i, `${i.name} deleted`); }}
              onEdit={(i) => setEdit(i)} onAdd={() => setEdit("new")} onCheck={() => setChecking(true)} />
          : tab === "scan" ? <Scan items={list} resolve={resolve} onAdd={onScanAdd} onManual={() => setEdit("new")} />
          : <List items={list} sizes={sizes} onCheck={() => setChecking(true)}
              onRemove={(i) => { store.removeFromList(home, i, fail); undoable(i, `${i.name} removed from your list`); }}
              onTick={(i, v) => store.setInBasket(home, i, v, fail)}
              onPutAway={(b) => { store.putAway(home, b, fail); say(`${b.length} ${b.length === 1 ? "item" : "items"} put away`); }} />}
      </main>
      <nav class="nav" aria-label="Tabs" {...bg}>
        <button class="tab" aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><span class="ic" aria-hidden="true">🏠</span>At Home</button>
        <button class="tab scan" aria-current={tab === "scan" ? "page" : undefined} onClick={() => setTab("scan")}><span class="ic" aria-hidden="true">▥</span>Scan</button>
        <button class="tab" aria-current={tab === "list" ? "page" : undefined} onClick={() => setTab("list")}><span class="ic" aria-hidden="true">🛒</span>List{toBuy > 0 && <span class="dot">{toBuy}</span>}</button>
      </nav>
      {edit && <EditSheet item={edit === "new" ? null : edit} onSave={saveEdit} onClose={() => setEdit(null)}
        onRemove={edit === "new" ? undefined : () => { store.removeItem(home, edit, fail); setEdit(null); say("Removed"); }} />}
      {sharing && <ShareSheet link={shareLink(home)} onClose={() => setSharing(false)}
        onNewList={() => { const id = newHomeId(); setHomeId(id); setHome(id); setSharing(false); say("New empty list started"); }}
        onBack={getPrevHomeId() ? () => { const id = getPrevHomeId()!; setHomeId(id); setHome(id); setSharing(false); say("Back on your previous list"); } : undefined} />}
      {joinId && joinId !== home && <JoinSheet myCount={list.length} onJoin={join} onCancel={() => { setJoinId(null); clearHash(); }} />}
      <div class={toast ? "toast" : "toast sr"}>
        <span role="status">{toast?.msg}</span>{toast?.undo && <button class="toast-undo" onClick={toast.undo}>Undo</button>}
      </div>
      {checking && <StockCheck items={list} sizes={sizes}
        onAnswer={(i, s) => store.setStock(home, i, s, fail)}
        onClose={(goList) => { setChecking(false); if (goList) setTab("list"); }} />}
      {tutorial && !(joinId && joinId !== home) && <Tutorial onDone={() => setTutorial(false)} />}
    </div>
  );
}
