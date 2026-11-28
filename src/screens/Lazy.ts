import { useEffect, useState } from "preact/hooks";
import { h, type ComponentType } from "preact";

/** Loads a screen's code only when it is first shown (keeps the first download small). */
export function Lazy<P>({ load, ...props }: { load: () => Promise<ComponentType<P>> } & P) {
  const [C, setC] = useState<ComponentType<P> | null>(null);
  useEffect(() => { load().then((c) => setC(() => c)); }, []);
  return C ? h(C as ComponentType<object>, props) : null;
}
