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
  /** How many the household usually keeps; the list then says how many to buy. */
  want?: number;
}

/** A barcode the household (or a public database) has named. */
export interface Product {
  name: string;
  icon: string;
  cat: Cat;
  size: string;
}

export const LIMITS = { name: 40, unit: 12, icon: 8, size: 30, qty: 999 } as const;

/** How many to buy: up to the usual amount, at least 1. 0 = no usual amount set. */
export const toBuy = (it: Pick<Item, "qty" | "want">) => (it.want ? Math.max(it.want - it.qty, 1) : 0);

export function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, LIMITS.name);
}

// Keyword -> emoji so each product gets its own icon; falls back to the category icon. First match wins.
const ICONS: [RegExp, string][] = [
  [/toothpaste|toothbrush|colgate|closeup/i, "🪥"], [/shampoo|conditioner|sunsilk|palmolive|head ?& ?shoulders|creamsilk/i, "🧴"],
  [/soap|safeguard|dove|body wash|lifebuoy|kojie/i, "🧼"], [/tissue|toilet paper|napkin/i, "🧻"],
  [/detergent|downy|fabric|surf\b|ariel|tide|breeze|labada|\bpowder/i, "🧺"], [/bleach|zonrox|disinfect|lysol|domex|toilet cleaner/i, "🧪"],
  [/dishwash|joy\b|sponge|scrub/i, "🧽"], [/trash|garbage/i, "🗑️"], [/diaper|pampers|eq dry|huggies|wipes/i, "🍼"],
  [/rice|bigas|jasmine/i, "🍚"], [/noodle|pancit|canton|lucky me|ramen|pasta|spaghetti/i, "🍜"], [/egg|itlog/i, "🥚"],
  [/milk|gatas|alaska|bear brand|milo|nestogen/i, "🥛"], [/coffee|kape|nescafe|kopiko|great taste/i, "☕"], [/tea\b|lipton/i, "🍵"],
  [/tuna|sardine|mackerel|corned|spam|luncheon|canned|ligo|555|century/i, "🥫"], [/soy|toyo|vinegar|suka|patis|ketchup|sauce|mayo|oyster/i, "🫙"],
  [/oil|mantika|minola|baguio/i, "🫗"], [/sugar|asukal|salt|asin|flour|harina/i, "🧂"], [/bread|pandesal|tinapay|loaf/i, "🍞"],
  [/biscuit|cracker|cookie|skyflakes|oreo|piattos|chips|nova|chippy|snack|candy|chocolate/i, "🍪"], [/juice|soda|coke|sprite|royal|pepsi|c2|water|mineral/i, "🥤"],
  [/chicken|manok|pork|baboy|beef|baka|hotdog|tocino|longganisa|meat/i, "🍗"], [/fish|bangus|tilapia|isda|shrimp|hipon/i, "🐟"],
  [/onion|sibuyas|garlic|bawang|tomato|kamatis|kangkong|vegetable|gulay|potato|patatas|carrot/i, "🥬"], [/banana|saging|mango|apple|orange|fruit|prutas/i, "🍌"],
];

export function pickIcon(name: string, cat: Cat): string {
  return ICONS.find(([re]) => re.test(name))?.[1] ?? CAT_ICON[cat];
}

const SIZE_RE = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grams?|ml|cl|l|lt|ltrs?|liters?|litres?|fl\.?\s*oz|oz)\b/gi;

/** Picks ONE size from text like "500 ml (16.9 fl oz)": grams (g, kg) first, then liters (ml, L), then oz. */
export function normalizeSize(raw: string): string {
  const found: { rank: number; text: string }[] = [];
  for (const m of raw.matchAll(SIZE_RE)) {
    const u = m[3].toLowerCase().replace(/\s+/g, "");
    const rank = /^(kg|g|gr|grams?)$/.test(u) ? 0 : /oz$/.test(u) ? 2 : 1;
    const unit = rank === 0 ? (u === "kg" ? "kg" : "g") : rank === 2 ? "oz" : u === "ml" ? "ml" : u === "cl" ? "cl" : "L";
    found.push({ rank, text: `${m[1] ? m[1] + " x " : ""}${m[2].replace(",", ".")} ${unit}` });
  }
  found.sort((a, b) => a.rank - b.rank);
  return (found[0]?.text ?? raw.trim()).slice(0, LIMITS.size);
}
