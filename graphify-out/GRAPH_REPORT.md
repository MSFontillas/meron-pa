# Graph Report - src  (2026-11-25)

## Corpus Check
- 19 files · ~8,010 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .css 1)

## Summary
- 117 nodes · 335 edges · 7 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `72a8a994`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Tutorial.tsx
- store.ts
- types.ts
- Scan.tsx
- app.tsx
- main.tsx
- config.ts

## God Nodes (most connected - your core abstractions)
1. `App()` - 38 edges
2. `Item` - 13 edges
3. `itemRef()` - 12 edges
4. `stamp()` - 12 edges
5. `pickIcon()` - 12 edges
6. `lookupBarcode()` - 10 edges
7. `useDialog()` - 9 edges
8. `Scan()` - 8 edges
9. `Tutorial()` - 8 edges
10. `findSame()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `Item`  [EXTRACTED]
  src/screens/Scan.tsx → src/data/types.ts
- `App()` --calls--> `getHomeId()`  [EXTRACTED]
  src/app.tsx → src/data/home.ts
- `App()` --calls--> `getPrevHomeId()`  [EXTRACTED]
  src/app.tsx → src/data/home.ts
- `App()` --calls--> `joinIdFromHash()`  [EXTRACTED]
  src/app.tsx → src/data/home.ts
- `App()` --calls--> `newHomeId()`  [EXTRACTED]
  src/app.tsx → src/data/home.ts

## Import Cycles
- None detected.

## Communities (7 total, 0 thin omitted)

### Community 0 - "Tutorial.tsx"
Cohesion: 0.16
Nodes (20): CATS, Item, toBuy(), AtHome(), Props, List(), Props, EditSheet() (+12 more)

### Community 1 - "store.ts"
Cohesion: 0.21
Nodes (26): App(), addToHome(), addToList(), changeQty(), copyItems(), editItem(), Fail, findSame() (+18 more)

### Community 2 - "types.ts"
Cohesion: 0.20
Nodes (13): codeVariants(), guessCat(), isBarcode(), lookupBarcode(), SOURCES, NewThing, Cat, CAT_ICON (+5 more)

### Community 3 - "Scan.tsx"
Cohesion: 0.14
Nodes (14): Product, Detector, FORMATS, makeDetector(), ScanError, startScanner(), Pending, Props (+6 more)

### Community 4 - "app.tsx"
Cohesion: 0.44
Nodes (8): Tab, getHomeId(), getPrevHomeId(), isHomeId(), joinIdFromHash(), newHomeId(), setHomeId(), shareLink()

### Community 5 - "main.tsx"
Cohesion: 0.52
Nodes (4): dark(), initTheme(), paint(), toggleTheme()

### Community 6 - "config.ts"
Cohesion: 0.40
Nodes (4): APP_NAME, appCheckKey, firebaseConfig, useEmulator

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `store.ts` to `Tutorial.tsx`, `types.ts`, `Scan.tsx`, `app.tsx`, `main.tsx`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Should `Scan.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Why does `Item` connect `Tutorial.tsx` to `store.ts`, `types.ts`, `Scan.tsx`, `app.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `pickIcon()` connect `types.ts` to `store.ts`, `Scan.tsx`, `app.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._