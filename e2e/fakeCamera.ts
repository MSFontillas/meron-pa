// Replaces the phone camera with a canvas that shows an EAN-13 barcode, so scanning can be tested.
export const fakeCamera = () => {
  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const R = L.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).join(""));
  const G = R.map((p) => [...p].reverse().join(""));
  const PAR = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  const bits = (code: string) => {
    const d = [...code].map(Number);
    let s = "101";
    for (let i = 1; i <= 6; i++) s += (PAR[d[0]][i - 1] === "L" ? L : G)[d[i]];
    s += "01010";
    for (let i = 7; i <= 12; i++) s += R[d[i]];
    return s + "101";
  };
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  let code = "";
  const draw = () => {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 640, 480);
    if (!code) return;
    const b = bits(code); ctx.fillStyle = "#000";
    [...b].forEach((v, i) => { if (v === "1") ctx.fillRect(60 + i * 5, 120, 5, 240); });
  };
  setInterval(draw, 50);
  (window as unknown as { __setBarcode: (c: string) => void }).__setBarcode = (c: string) => { code = c; draw(); };
  navigator.mediaDevices.getUserMedia = async () => {
    const s = canvas.captureStream(20);
    (window as unknown as { __stream: MediaStream }).__stream = s;
    await new Promise((r) => setTimeout(r, 300)); // a real camera takes a moment to start
    return s;
  };
};
