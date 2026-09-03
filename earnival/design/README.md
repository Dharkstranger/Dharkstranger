# The screen set

All 136 states from `docs/SCREEN-MANIFEST.md`, as real HTML frames at device
size using the product's own brand tokens. Not screenshots — every frame is
live markup, so it imports into Figma as editable layers.

## Getting them into Figma

1. Install **html.to.design** in Figma (the free tier covers this)
2. Run it → **Import from URL** → paste the published page's URL
3. Each frame arrives as auto-layout with live text layers, real colours and
   real type

Phone frames are 390×844. Console frames are 1100×760.

## Regenerating

```bash
cd design
python3 gen_a.py && python3 gen_b.py && python3 gen_c.py && python3 assemble.py
```

`lib.py` holds the tokens and the component helpers — button, pill, field,
card, stat, empty state, note. Change a token there and every one of the 136
frames follows, which is the point of generating them rather than drawing them.

The three generators map onto the manifest's sections:

| File | Covers | States |
|---|---|---|
| `gen_a.py` | Public and buyer | 53 |
| `gen_b.py` | Auth, organiser | 50 |
| `gen_c.py` | Vendor, admin, legal, system | 33 |

If you add a state to the manifest, add it to the matching generator and the
count in `assemble.py` follows automatically.
