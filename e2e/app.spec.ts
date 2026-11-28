import { test, expect, type Page } from "@playwright/test";
import { fakeCamera } from "./fakeCamera";

const nav = (p: Page, name: string) => p.getByRole("navigation").getByRole("button", { name });
const card = (p: Page, name: string) => p.locator(`.item[data-item="${name}"]`);

const seen = (p: Page) => p.addInitScript(() => { try { localStorage.setItem("tutorialSeen", "1"); } catch { /* ignore */ } });

/** Drags a row sideways with the mouse (pointer events), like a finger swipe. */
async function swipe(page: Page, row: ReturnType<Page["locator"]>, dir: "left" | "right") {
  const b = (await row.boundingBox())!;
  const y = b.y + b.height / 2, x = b.x + b.width / 2, to = x + (dir === "right" ? 1 : -1) * b.width * 0.45;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(to, y + 3, { steps: 8 }); await page.mouse.up();
}

async function open(page: Page) {
  await seen(page);
  await page.addInitScript(fakeCamera);
  await page.route(/open(food|beauty|products)facts\.org/, (r) => {
    if (r.request().url().includes("4801234012342"))
      return r.fulfill({ json: { status: 1, product: { product_name: "Corned Beef", brands: "Purefoods", quantity: "150 g" } } });
    return r.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "At Home" })).toBeVisible();
  await expect(page.getByText("Nothing here yet")).toBeVisible();
}

async function addByHand(page: Page, name: string, qty = 1) {
  await page.getByRole("button", { name: "Add something by hand" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("How many at home?").fill(String(qty));
  await page.getByRole("button", { name: "Save" }).click();
}

test("add, count, run out, shop with undo, put away", async ({ page }) => {
  await open(page);
  await addByHand(page, "Shampoo sachets", 2);
  await expect(card(page, "Shampoo sachets").locator("output")).toHaveText(/^2/);
  await card(page, "Shampoo sachets").getByRole("button", { name: "One more Shampoo sachets" }).click();
  await expect(card(page, "Shampoo sachets").locator("output")).toHaveText(/^3/);
  await swipe(page, card(page, "Shampoo sachets"), "right"); // ran out
  await expect(card(page, "Shampoo sachets")).toHaveCount(0);
  await addByHand(page, "Kangkong", 1);
  await swipe(page, card(page, "Kangkong"), "right");

  await nav(page, "List").click();
  await expect(page.getByText("2 to buy")).toBeVisible();
  await expect(page.getByPlaceholder("Add an item…")).toHaveCount(0);
  const row = (n: string) => page.locator(`.check[data-item="${n}"]`);
  await row("Shampoo sachets").click();
  await row("Kangkong").click();
  await expect(page.getByRole("button", { name: "Put 2 items away" })).toBeVisible();
  await row("Kangkong").click(); // undo
  await expect(page.getByRole("button", { name: "Put 1 item away" })).toBeVisible();
  await page.getByRole("button", { name: "Put 1 item away" }).click();
  await expect(page.getByText("1 to buy")).toBeVisible();

  await nav(page, "At Home").click();
  await expect(card(page, "Shampoo sachets").locator("output")).toHaveText(/^1/);
});

const mode = (p: Page, name: string) => p.getByRole("group", { name: "Scanned items go to" }).getByRole("button", { name });
const show = async (p: Page, code: string) => { // take the old barcode out of view first, like a real hand
  await p.evaluate(() => (window as any).__setBarcode(""));
  await p.waitForTimeout(1200);
  await p.evaluate((c) => (window as any).__setBarcode(c), code);
};

test("scan: known products add straight away, an unknown one is named once", async ({ page }) => {
  await open(page);
  await nav(page, "Scan").click();
  await expect(mode(page, "At Home")).toHaveAttribute("aria-pressed", "true");
  await show(page, "4801234012342");
  await expect(page.getByText("Purefoods Corned Beef +1 At Home")).toBeVisible({ timeout: 20_000 });

  await show(page, "4809012090124");
  await expect(page.getByRole("heading", { name: "New product" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Product name").fill("Ube jam");
  await page.getByRole("button", { name: "Add to At Home" }).click();

  await show(page, "4809012090124"); // same jar again: now known, no questions
  await expect(page.getByText("Ube jam +1 At Home")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500); // the toast above is still the first one; let the second scan land

  await nav(page, "At Home").click();
  await expect(card(page, "Purefoods Corned Beef").locator("output")).toHaveText("1");
  await expect(card(page, "Ube jam").locator("output")).toHaveText("2");
});

test("scan: a product only in the catalog is found without asking Open Facts", async ({ page }) => {
  await seen(page);
  await page.addInitScript(fakeCamera);
  let off = 0;
  await page.route(/open(food|beauty|products|petfood)facts\.org/, (r) => { off++; return r.abort(); });
  await page.route("**/catalog.json", (r) => r.fulfill({ json: { "4800016644801": ["Piattos Cheese", "Food & drinks", "45 g"] } }));
  await page.goto("/");
  await nav(page, "Scan").click();
  await show(page, "4800016644801");
  await expect(page.getByText("Piattos Cheese +1 At Home")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("From the Meron Pa? catalog")).toBeVisible();
  expect(off).toBe(0);
});

test("scan to List warns when you still have some; scan to At Home takes it off the list; Undo", async ({ page }) => {
  await open(page);
  await nav(page, "Scan").click();
  await show(page, "4801234012342");
  await expect(page.getByText("Purefoods Corned Beef +1 At Home")).toBeVisible({ timeout: 20_000 });

  await mode(page, "List").click();
  await show(page, "4801234012342");
  await expect(page.getByRole("heading", { name: "You still have 1 Purefoods Corned Beef" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "No", exact: true }).click();
  await show(page, "4801234012342");
  await page.getByRole("button", { name: "Add to List" }).click();
  await expect(page.getByText("Purefoods Corned Beef added to your list")).toBeVisible();

  await nav(page, "At Home").click(); // leave and come back: the switch is remembered
  await nav(page, "Scan").click();
  await expect(mode(page, "List")).toHaveAttribute("aria-pressed", "true");
  await mode(page, "At Home").click();
  await show(page, "4801234012342");
  await expect(page.getByText("Purefoods Corned Beef +1 At Home, off your list")).toBeVisible({ timeout: 20_000 });
  await nav(page, "List").click();
  await expect(page.getByText("0 to buy")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click(); // back on the list, 1 at home
  await expect(page.getByText("1 to buy")).toBeVisible();
  await nav(page, "At Home").click();
  await expect(card(page, "Purefoods Corned Beef").locator("output")).toHaveText("1");
});

test("share link: a second phone joins and both see changes", async ({ browser }) => {
  const a = await (await browser.newContext({ permissions: ["camera"], viewport: { width: 390, height: 844 } })).newPage();
  await open(a);
  await addByHand(a, "Rice, 5 kg", 1);
  await a.getByRole("button", { name: "Share list" }).click();
  const link = (await a.locator(".share-link").textContent())!;
  expect(link).toMatch(/#join=[A-Za-z0-9_-]{22}$/);
  await a.getByRole("button", { name: "Close" }).click();

  const b = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await seen(b);
  await b.goto(link);
  await b.getByRole("button", { name: "Join", exact: true }).click();
  await nav(b, "At Home").click();
  await expect(card(b, "Rice, 5 kg")).toBeVisible();

  await swipe(b, card(b, "Rice, 5 kg"), "right");
  await nav(a, "List").click();
  await expect(a.locator('.check[data-item="Rice, 5 kg"]')).toBeVisible();
});

test("keeps working offline", async ({ page, context }) => {
  await open(page);
  await context.setOffline(true);
  await addByHand(page, "Toothpaste", 1);
  await expect(card(page, "Toothpaste")).toBeVisible();
  await context.setOffline(false);
});

test("starting a new list keeps the old one reachable", async ({ page }) => {
  await open(page);
  await addByHand(page, "Bleach", 1);
  await page.getByRole("button", { name: "Share list" }).click();
  await page.getByRole("button", { name: "Start a new empty list on this phone" }).click();
  await page.getByRole("button", { name: "Yes, start a new empty list" }).click();
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  await page.getByRole("button", { name: "Share list" }).click();
  await page.getByRole("button", { name: "Go back to my previous list" }).click();
  await expect(card(page, "Bleach")).toBeVisible();
});

test("leaving Scan while the camera starts turns the camera off", async ({ page }) => {
  await open(page);
  await nav(page, "Scan").click();
  await nav(page, "At Home").click(); // leave before the camera finished starting
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as any).__stream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"))).toBe(true);
});

test("joining a shared list works with no signal", async ({ browser }) => {
  const a = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await open(a);
  await a.getByRole("button", { name: "Share list" }).click();
  const link = (await a.locator(".share-link").textContent())!;

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await ctx.newPage();
  await open(b);
  await addByHand(b, "Garlic", 2);
  await ctx.setOffline(true);
  await b.goto(link).catch(() => {}); // same page, only the hash changes
  await b.evaluate((l) => { location.hash = new URL(l).hash; }, link);
  await b.getByRole("button", { name: "Join and bring my 1 item" }).click();
  await expect(b.getByText("You're now on the shared list")).toBeVisible();
  await ctx.setOffline(false);
});

test("refuses to run inside another site's frame", async ({ page }) => {
  await page.goto("/");
  await page.setContent(`<iframe src="${page.url()}" width="390" height="600"></iframe>`);
  const f = page.frameLocator("iframe");
  await expect(f.getByText("Open Meron Pa? directly")).toBeVisible();
  await expect(f.getByRole("heading", { name: "At Home" })).toHaveCount(0);
});

test("swipe left deletes, Undo brings it back; vertical drags don't swipe", async ({ page }) => {
  await open(page);
  await addByHand(page, "Toyo", 3);
  const row = card(page, "Toyo"), b = (await row.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 10); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 20, b.y + 200, { steps: 8 }); await page.mouse.up(); // mostly down = scroll
  await expect(row).toBeVisible();

  await swipe(page, row, "left");
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "Toyo").locator("output")).toHaveText("3");
});

test("List: swipe right removes, Undo puts it back", async ({ page }) => {
  await open(page);
  await addByHand(page, "Bleach", 1);
  await swipe(page, card(page, "Bleach"), "right");
  await nav(page, "List").click();
  const row = page.locator('.check[data-item="Bleach"]');
  await swipe(page, row, "right");
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0); // the swipe did not tick it
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-checked", "false");
});

test("practice demo on first open: every step, nothing saved, not shown again", async ({ page }) => {
  await page.goto("/");
  const demo = page.getByRole("dialog", { name: "Practice" });
  const row = (n: string) => demo.locator(`.item[data-item="${n}"]`);
  await expect(demo).toContainText("Toyo is used up");
  await demo.getByRole("button", { name: /^Ubos na/ }).click();
  await expect(demo).toContainText("Rice ran out too");
  await swipe(page, row("Eggs"), "right"); // wrong row: does not advance
  await expect(demo).toContainText("Rice ran out too");
  await page.reload(); // not finished: starts again
  await demo.getByRole("button", { name: /^Ubos na/ }).click();
  await swipe(page, row("Rice"), "right");
  await swipe(page, row("Eggs"), "left");
  await expect(row("Eggs")).toHaveCount(0);
  await demo.getByRole("button", { name: "Undo" }).click();
  await expect(row("Eggs")).toBeVisible();
  await expect(demo).toContainText("tap Toyo to put it in your basket");
  await demo.locator('.check[data-item="Toyo"]').click();
  await demo.getByRole("button", { name: "Put 1 item away" }).click();
  await demo.getByRole("button", { name: "Start using Meron Pa?" }).click();
  await expect(demo).toHaveCount(0);
  await expect(page.getByText("Nothing here yet")).toBeVisible(); // practice items were not saved
  await page.reload();
  await expect(page.getByRole("heading", { name: "At Home" })).toBeVisible();
  await expect(demo).toHaveCount(0);
});

test("practice demo can be skipped", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "Practice" }).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("stock check before shopping: out, low, below usual, back, list says how many", async ({ page }) => {
  await open(page);
  await addByHand(page, "Eggs", 6);
  await addByHand(page, "Rice", 2);
  await addByHand(page, "Toyo", 1);
  await card(page, "Eggs").getByRole("button", { name: "Eggs", exact: true }).click();
  await page.getByLabel("Usually keep (optional)").fill("12");
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Check stock before shopping" }).click();
  const sc = page.getByRole("dialog", { name: "Check stock" });
  await expect(sc.getByRole("heading", { level: 2 })).toHaveText("Eggs"); // alphabetical within Food & drinks
  await expect(sc).toContainText("Usually keep 12");
  await sc.getByRole("button", { name: "One less" }).click(); // 5 left
  await expect(sc.getByRole("button", { name: /^Meron pa/ })).toContainText("Below your usual 12");
  await sc.getByRole("button", { name: /^Meron pa/ }).click();
  await expect(sc.getByRole("heading", { level: 2 })).toHaveText("Rice");
  await sc.getByRole("button", { name: /^Ubos na/ }).click();
  await sc.getByRole("button", { name: "Back" }).click(); // change Rice to "low"
  await sc.getByRole("button", { name: /^Kaunti na/ }).click();
  await sc.getByRole("button", { name: /^Meron pa/ }).click(); // Toyo: enough
  await expect(sc).toContainText("2 things added to your list");
  await sc.getByRole("button", { name: "Go to my list" }).click();

  await expect(page.getByText("2 to buy")).toBeVisible();
  await expect(page.locator('.check[data-item="Eggs"]')).toContainText("Buy 7");
  await expect(page.locator('.check[data-item="Toyo"]')).toHaveCount(0);
  await page.locator('.check[data-item="Eggs"]').click();
  await page.getByRole("button", { name: "Put 1 item away" }).click();
  await nav(page, "At Home").click();
  await expect(card(page, "Eggs").locator("output")).toHaveText("12"); // filled up to the usual amount
  await expect(card(page, "Rice").locator("output")).toHaveText("2"); // low keeps the count
});

test("screen reader tree: names, roles and states", async ({ page }) => {
  await open(page);
  await addByHand(page, "Toyo", 1);
  await expect(page.getByRole("navigation", { name: "Tabs" })).toMatchAriaSnapshot(`
    - navigation "Tabs":
      - button "At Home"
      - button "Scan"
      - button "List"
  `);
  await expect(page.getByRole("main")).toMatchAriaSnapshot(`
    - main:
      - button "Check stock before shopping"
      - button "Toyo"
      - button "One less Toyo"
      - status "1 at home"
      - button "One more Toyo"
  `);
  await nav(page, "Scan").click();
  await expect(page.getByRole("group", { name: "Scanned items go to" })).toMatchAriaSnapshot(`
    - group "Scanned items go to":
      - button "At Home" [pressed]
      - button "List"
  `);
  await nav(page, "At Home").click();
  await page.getByRole("button", { name: "Check stock before shopping" }).click();
  await expect(page.getByRole("dialog", { name: "Check stock" })).toMatchAriaSnapshot(`
    - dialog "Check stock":
      - banner:
        - heading "Check stock" [level=1]
        - button "Stop"
      - paragraph: 1 of 1
      - heading "Toyo" [level=2]
      - paragraph: "Last count: 1"
      - group "How many left? (optional)":
        - button "One less"
        - status
        - button "One more"
      - button /Ubos na/
      - button /Kaunti na/
      - button /Meron pa/
  `);
  await page.getByRole("button", { name: /^Ubos na/ }).click();
  await page.getByRole("button", { name: "Go to my list" }).click();
  await expect(page.getByRole("checkbox", { name: "Toyo" })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".toast [role=status]")).toHaveCount(1); // one always-present live region
});

test("a long list scrolls; rows keep their full height (were squashed to fit the screen)", async ({ page }) => {
  await open(page);
  for (let i = 0; i < 12; i++) await addByHand(page, `Item ${i}`, 1);
  const hs = await page.locator(".item").evaluateAll((els) => els.map((e) => (e as HTMLElement).offsetHeight));
  expect(Math.min(...hs)).toBeGreaterThanOrEqual(56);
  const view = page.locator("main.view");
  expect(await view.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true); // it scrolls instead of squeezing
  await expect(page.locator('.item[data-item="Item 11"]')).toBeAttached();
});

test("touch targets are at least 44px", async ({ page }) => {
  await open(page);
  await addByHand(page, "Toyo", 1);
  const small = await page.evaluate(() => [...document.querySelectorAll("button, select, input")].map((e) => {
    const r = (e as HTMLElement).getBoundingClientRect(); return { t: ((e as HTMLElement).innerText || e.getAttribute("aria-label") || "").slice(0, 20), w: r.width, h: r.height };
  }).filter((x) => x.w && x.h && (x.w < 44 || x.h < 44)));
  expect(small.filter((x) => x.t !== "Toyo")).toEqual([]);
  const tap = await page.locator(".item-name").evaluate((e) => { const r = getComputedStyle(e, "::after"); return parseFloat(r.height); }); // overlay grows the target
  expect(tap).toBeGreaterThanOrEqual(44);
});

test("keyboard: dialogs trap Tab, Escape closes, focus returns; toast is a live region", async ({ page }) => {
  await open(page);
  await addByHand(page, "Eggs", 6);
  const live = page.locator('[role="status"]').filter({ hasNotText: /^\d+$/ });
  await expect(page.locator(".toast")).toHaveCount(1); // present from the start, so the first message is announced
  const stockBtn = page.getByRole("button", { name: "Check stock before shopping" });
  await page.waitForTimeout(150); // the closed edit sheet hands focus back to its opener first
  await stockBtn.focus(); await expect(stockBtn).toBeFocused(); await page.keyboard.press("Enter");
  const dlg = page.getByRole("dialog", { name: "Check stock" });
  await expect(dlg).toBeVisible();
  for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true); }
  expect(await page.locator("main").evaluate((e) => e.hasAttribute("inert"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(stockBtn).toBeFocused();

  await page.getByRole("button", { name: "Share list" }).click();
  await expect(page.getByRole("dialog", { name: "Share this list" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share list" })).toBeFocused();
  await page.getByRole("button", { name: "One more Eggs" }).click();
  void live;
});


test("optional prices: tick box, price card, list total, edit sheet, undo", async ({ page }) => {
  await open(page);
  await nav(page, "Scan").click();
  const ask = page.getByLabel("Ask for price on each scan");
  await expect(ask).not.toBeChecked();
  await show(page, "4801234012342"); // off: adds at once, no price question
  await expect(page.getByText("Purefoods Corned Beef +1 At Home")).toBeVisible({ timeout: 20_000 });

  await ask.check();
  await mode(page, "List").click();
  await page.waitForTimeout(500);
  await show(page, "4801234012342");
  await page.getByRole("button", { name: "Add to List" }).click(); // "you still have 1" question
  await expect(page.getByText("No price saved yet")).toBeVisible();
  await page.getByLabel("Price (₱)").fill("abc");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't look like a price");
  await page.getByLabel("Price (₱)").fill("45.50");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByText("Purefoods Corned Beef added to your list · ₱45.50")).toBeVisible();

  await nav(page, "List").click();
  await expect(page.locator('.check[data-item="Purefoods Corned Beef"]')).toContainText("₱45.50");
  await expect(page.getByText("About ₱45.50 for 1 item")).toBeVisible();

  await nav(page, "At Home").click();
  await card(page, "Purefoods Corned Beef").getByRole("button", { name: "Purefoods Corned Beef", exact: true }).click();
  await expect(page.getByLabel("Price (₱, optional)")).toHaveValue("45.5");
  await page.getByLabel("Price (₱, optional)").fill("50");
  await page.getByRole("button", { name: "Save" }).click();
  await nav(page, "List").click();
  await expect(page.getByText("About ₱50 for 1 item")).toBeVisible();
  await page.reload();
  await nav(page, "Scan").click();
  await expect(page.getByLabel("Ask for price on each scan")).toBeChecked(); // remembered
});

test("admin: a name typed while scanning is sent to the shared catalog", async ({ page }) => {
  const puts: string[] = [];
  await page.route("https://api.github.com/**", (r) => {
    const req = r.request();
    if (req.method() === "PUT") { puts.push(req.postData() ?? ""); return r.fulfill({ status: 200, json: {} }); }
    if (req.url().includes("/contents/")) return r.fulfill({ json: { sha: "s1", content: Buffer.from("barcode,name,brand,size,kind,give_back\n").toString("base64") } });
    return r.fulfill({ json: { permissions: { push: true } } });
  });
  await open(page);
  await expect(page.getByRole("button", { name: /^Admin/ })).toHaveCount(0); // ordinary users never see it
  await page.goto("/#admin");
  await page.getByLabel("Token").fill("github_pat_test");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Connected to")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await nav(page, "Scan").click();
  await show(page, "4809012090124");
  await expect(page.getByRole("heading", { name: "New product" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Product name").fill("Ube jam");
  await page.getByLabel("Size, optional").fill("340 g");
  await expect(page.getByLabel("Add to the shared catalog")).toBeChecked();
  await page.getByRole("button", { name: "Add to At Home" }).click();

  await page.getByRole("button", { name: "Admin (1)" }).click();
  await expect(page.getByText("1 product waiting")).toBeVisible();
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/Sent 1/)).toBeVisible();
  expect(Buffer.from(JSON.parse(puts[0]).content, "base64").toString()).toContain("4809012090124,Ube jam");

  await page.getByRole("button", { name: "Sign out of admin" }).click();
  await expect(page.getByRole("button", { name: /^Admin/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBeNull();
});
