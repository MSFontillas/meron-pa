import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173/", viewport: { width: 390, height: 844 }, permissions: ["camera"] },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173/",
    env: { VITE_USE_EMULATOR: "1" },
    reuseExistingServer: false,
  },
});
