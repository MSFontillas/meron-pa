/** True when `url` answers (any answer) within `ms`. Used to spot a blocked third-party script before waiting on it. */
export async function reachable(url: string, ms = 3000, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const ctl = new AbortController(); // AbortSignal.timeout is missing on iOS < 16
  const t = setTimeout(() => ctl.abort(), ms);
  try { await fetchFn(url, { mode: "no-cors", signal: ctl.signal }); return true; }
  catch { return false; }
  finally { clearTimeout(t); }
}

/** Rejects with "slow" if `p` takes longer than `ms`; the work itself is not cancelled. */
export function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error("slow")), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}
