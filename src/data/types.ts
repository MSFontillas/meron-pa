export const CATS = ["Food & drinks", "Laundry", "Bathroom", "Cleaning", "Baby", "Other"] as const;
export type Cat = (typeof CATS)[number];

export const CAT_ICON: Record<Cat, string> = {
  "Food & drinks": "🍽️", Laundry: "🧺", Bathroom: "🧴", Cleaning: "🧽", Baby: "🍼", Other: "📦",
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

// Whole words -> emoji so each product gets its own icon; otherwise the category icon.
// Only the earliest keyword in the name counts ("Coffee with sugar" is coffee), and a keyword next to a
// negator ("no sugar", "sugar-free", "zero salt") is ignored.
const ICONS: [string[], string][] = [
  [["toothpaste", "toothbrush", "colgate", "closeup"], "🪥"], [["shampoo", "conditioner", "sunsilk", "palmolive", "head & shoulders", "creamsilk"], "🧴"],
  [["soap", "safeguard", "dove", "body wash", "lifebuoy", "kojie"], "🧼"], [["tissue", "toilet paper", "napkin"], "🧻"],
  [["detergent", "downy", "fabric", "surf", "ariel", "tide", "breeze", "labada", "powder"], "🧺"], [["bleach", "zonrox", "disinfect", "lysol", "domex", "toilet cleaner"], "🧪"],
  [["dishwash", "joy", "sponge", "scrub"], "🧽"], [["trash", "garbage"], "🗑️"], [["diaper", "pampers", "eq dry", "huggies", "wipes"], "🍼"],
  [["rice", "bigas", "jasmine"], "🍚"], [["noodle", "pancit", "canton", "lucky me", "ramen", "pasta", "spaghetti"], "🍜"], [["egg", "itlog"], "🥚"],
  [["milk", "gatas", "alaska", "bear brand", "milo", "nestogen"], "🥛"], [["coffee", "kape", "nescafe", "kopiko", "great taste"], "☕"], [["tea", "lipton"], "🍵"],
  [["tuna", "sardine", "mackerel", "corned", "spam", "luncheon", "canned", "ligo", "555", "century"], "🥫"], [["soy", "toyo", "vinegar", "suka", "patis", "ketchup", "sauce", "mayo", "oyster"], "🫙"],
  [["oil", "mantika", "minola", "baguio"], "🫗"], [["sugar", "asukal", "salt", "asin", "flour", "harina"], "🧂"], [["bread", "pandesal", "tinapay", "loaf"], "🍞"],
  [["biscuit", "cracker", "cookie", "skyflakes", "oreo", "piattos", "chips", "nova", "chippy", "snack", "candy", "chocolate"], "🍪"], [["juice", "soda", "coke", "sprite", "royal", "pepsi", "c2", "water", "mineral"], "🥤"],
  [["chicken", "manok", "pork", "baboy", "beef", "baka", "hotdog", "tocino", "longganisa", "meat"], "🍗"], [["fish", "bangus", "tilapia", "isda", "shrimp", "hipon"], "🐟"],
  [["onion", "sibuyas", "garlic", "bawang", "tomato", "kamatis", "kangkong", "vegetable", "gulay", "potato", "patatas", "carrot"], "🥬"], [["banana", "saging", "mango", "apple", "orange", "fruit", "prutas"], "🍌"],
];

const wordRe = (w: string) => new RegExp(`(?<![\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ & /g, " ?& ?")}(?:s|es)?(?![\\p{L}\\d])`, "giu");
const COMPILED = ICONS.map(([ws, icon]) => ({ icon, res: ws.map(wordRe) }));
const NEG_BEFORE = /(?:^|[^\p{L}])(?:no|zero|non|without|walang|sans|less)[\s-]*$/iu;
const NEG_AFTER = /^[\s-]*(?:free|less)(?![\p{L}])/iu;

export function pickIcon(name: string, cat: Cat): string {
  let best: { at: number; icon: string } | null = null;
  for (const { icon, res } of COMPILED) for (const re of res) {
    re.lastIndex = 0;
    for (const m of name.matchAll(re)) {
      const at = m.index ?? 0;
      if (NEG_BEFORE.test(name.slice(0, at)) || NEG_AFTER.test(name.slice(at + m[0].length))) continue;
      if (!best || at < best.at) best = { at, icon };
      break; // later matches of this word cannot be earlier
    }
  }
  return best?.icon ?? CAT_ICON[cat];
}

/** CSS class that tints the icon square by category (colour is never the only cue: headings name the category). */
export const catClass = (c: Cat) => "cat-" + c.split(/[ &]/)[0].toLowerCase();

const SIZE_RE = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grams?|ml|cl|l|lt|ltrs?|liters?|litres?|fl\.?\s*oz|oz)\b/gi;

/** Picks ONE size from text like "500 ml (16.9 fl oz)": grams (g, kg) first, then liters (ml, L), then oz. */
export function normalizeSize(raw: string): string {
  raw = raw.slice(0, 100); // the regex is quadratic on long digit runs; the text comes from crowd-edited databases
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
