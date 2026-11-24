import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH is "/<repo-name>/" on GitHub Pages; "/" locally.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    preact(),
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
        theme_color: "#2C8A4B",
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
