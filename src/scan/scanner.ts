import { BarcodeDetector as ZXingDetector, prepareZXingModule } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Serve the WebAssembly decoder from our own site (works offline, no third-party CDN).
prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) } });

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;
type Detector = { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> };

async function makeDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const ok = await Native.getSupportedFormats();
      if (FORMATS.every((f) => ok.includes(f))) return new Native({ formats: [...FORMATS] });
    } catch { /* fall back to ZXing */ }
  }
  return new ZXingDetector({ formats: [...FORMATS] });
}

export type ScanError = "no-camera" | "denied" | "failed";

/** Opens the back camera in `video` and calls onCode once with the first barcode seen. Returns stop(). */
export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) throw "no-camera" as ScanError;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (e) {
    throw ((e as DOMException)?.name === "NotAllowedError" ? "denied" : "no-camera") as ScanError;
  }
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await video.play().catch(() => {});
  const detector = await makeDetector();
  let stopped = false;
  const stop = () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const hit = (await detector.detect(video))[0];
        if (hit?.rawValue && !stopped) { stop(); onCode(hit.rawValue); return; }
      }
    } catch { /* a bad frame; keep trying */ }
    setTimeout(tick, 150);
  };
  tick();
  return stop;
}
