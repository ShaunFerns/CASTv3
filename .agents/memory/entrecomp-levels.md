---
name: EntreComp level system
description: How EC's unique levels integrate with the shared GA/GC/DC level infrastructure
---

EntreComp uses levels: None / Foundation / Intermediate / Advanced  
All other lenses (GA, GreenComp, DigComp) use: None / Developing / Consolidating / Leading

**Rule:** `LEVEL_ORDER` maps both sets to the same numeric values so shared logic works:
```ts
{ None: 0, Developing: 1, Consolidating: 2, Leading: 3, Foundation: 1, Intermediate: 2, Advanced: 3 }
```

**Why:** Numeric comparison (≥ 3 = solid border, 2 = solid thin, 1 = dashed) works across all lenses without lens-aware branching everywhere.

**How to apply:**
- `EC_LEVELS = ["None","Foundation","Intermediate","Advanced"]` defined alongside `LEVELS`
- Components pass the correct levels array: `const activeLevels = lens.apiLens === "entrecomp" ? EC_LEVELS : LEVELS`
- `nextLevel(l, levels)` accepts an optional levels array (defaults to LEVELS)
- `Level` union type includes all 7 values; typed as `string` where needed to avoid union exhaustiveness errors
- Border style uses LEVEL_ORDER numeric comparison, NOT string matching, so EC levels work automatically
- `levelStyle` / `levelBadgeClass` check string pairs: `"Developing" || "Foundation"` for low-level, `"Consolidating" || "Intermediate"` for mid-level, else = high/filled
