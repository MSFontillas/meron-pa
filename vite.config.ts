import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages cannot send headers, so the policy goes in a <meta> tag (built pages only; the dev server and tests are untouched).
// Everything the app talks to is listed here: Firebase, reCAPTCHA Enterprise (App Check) and the Open * Facts product databases.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://www.google.com https://www.gstatic.com",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com https://recaptcha.google.com https://world.openfoodfacts.org https://world.openbeautyfacts.org https://world.openproductsfacts.org https://world.openpetfoodfacts.org",
  "frame-src https://www.google.com https://recaptcha.google.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
// Start the TLS handshakes (and the reCAPTCHA download) while our own script is still loading.
const hints = ["https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com",
  ...(process.env.VITE_RECAPTCHA_SITE_KEY ? ["https://www.google.com", "https://www.gstatic.com"] : [])];
const cspPlugin = {
  name: "csp-meta", apply: "build" as const,
  transformIndexHtml: () => [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" as const },
    ...hints.map((href) => ({ tag: "link", attrs: { rel: "preconnect", href, crossorigin: "" }, injectTo: "head" as const })),
    ...(process.env.VITE_RECAPTCHA_SITE_KEY ? [{ tag: "link", attrs: { rel: "preload", as: "script", href: "https://www.google.com/recaptcha/enterprise.js?render=explicit" }, injectTo: "head" as const }] : []),
  ],
};

// BASE_PATH is "/<repo-name>/" on GitHub Pages; "/" locally.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    preact(),
    cspPlugin,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Meron Pa?",
        short_name: "Meron Pa?",
        description: "Track groceries and household supplies at home, and what you need to buy.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#FBF5E9",
        theme_color: "#FBF5E9",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        // The barcode decoder (only needed on phones without a built-in one) is cached on first scan.
        runtimeCaching: [{ urlPattern: /\.wasm$/, handler: "CacheFirst", options: { cacheName: "wasm" } }],
        navigateFallback: "index.html",
      },
    }),
  ],
});
