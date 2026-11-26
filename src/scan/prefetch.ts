import decoderUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

/** On phones without a built-in barcode detector (iPhone), fetch the decoder once the app is idle so the first scan is not a 1 MB wait. */
export function prefetchDecoder(): void {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if ("BarcodeDetector" in globalThis || nav.connection?.saveData) return;
  setTimeout(() => {
    void import("./scanner").catch(() => {}); // the code
    void fetch(decoderUrl).catch(() => {}); // the decoder; the service worker keeps it for next time
  }, 10_000);
}
