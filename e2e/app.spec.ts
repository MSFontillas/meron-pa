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

  await page.reload(); // the switch is remembered
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
  await expect(demo).toContainText("Tap + on Eggs");
  await swipe(page, row("Rice"), "right"); // wrong move: does not advance
  await expect(demo).toContainText("Tap + on Eggs");
  await row("Eggs").getByRole("button", { name: "One more Eggs" }).click();
  await swipe(page, row("Toyo"), "right");
  await expect(demo).toContainText("Swipe Rice to the left");
  await page.reload(); // still not finished: shows again from the start
  await expect(demo).toContainText("Tap + on Eggs");
  await row("Eggs").getByRole("button", { name: "One more Eggs" }).click();
  await swipe(page, row("Toyo"), "right");
  await swipe(page, row("Rice"), "left");
  await expect(row("Rice")).toHaveCount(0);
  await demo.getByRole("button", { name: "Undo" }).click();
  await expect(row("Rice")).toBeVisible();
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
