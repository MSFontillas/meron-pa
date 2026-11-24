export const CATS = ["Food & drinks", "Laundry", "Bathroom", "Cleaning", "Baby", "Other"] as const;
export type Cat = (typeof CATS)[number];

export const CAT_ICON: Record<Cat, string> = {
  "Food & drinks": "🍚", Laundry: "🧺", Bathroom: "🧴", Cleaning: "🧽", Baby: "🍼", Other: "📦",
};

/** One thing the household buys. qty = how many are at home; onList = needs buying. */
export interface Item {
  id: string;
  name: string;
  icon: string;
  cat: Cat;
  qty: number;
  unit: string;
  onList: boolean;
  inBasket: boolean;
  barcode?: string;
}

/** A barcode the household (or a public database) has named. */
export interface Product {
  name: string;
  icon: string;
  cat: Cat;
  size: string;
}

export const LIMITS = { name: 40, unit: 12, icon: 8, size: 30, qty: 999 } as const;

export function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, LIMITS.name);
}
