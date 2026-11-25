const KEY = "theme";
const dark = () => document.documentElement.dataset.theme === "dark"
  || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

function paint() {
  // Status bar and bottom bar follow the page colour instead of the old green.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark() ? "#1B1426" : "#FBF5E9"));
}

export function initTheme() {
  try { const t = localStorage.getItem(KEY); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch { /* private mode */ }
  paint();
}

export function toggleTheme(): boolean {
  const next = dark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* not remembered */ }
  paint();
  return next === "dark";
}
