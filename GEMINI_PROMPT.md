# Gemini prompts for LingEmbed visualisations

Two prompts. **Prompt A** is for an image model (Gemini image generation): a static hero illustration or poster figure. **Prompt B** is for Gemini Canvas, or any code-capable Gemini model: an interactive web figure that can go into the site.

---

## Prompt A — hero illustration / paper figure (image generation)

```
Create a wide (16:9) scientific illustration titled "LingEmbed: embedding linguistic theory into neural representations".

Composition: three zones flowing left → right, connected by luminous streams of particles.

LEFT ZONE: "Symbolic". Crisp, glowing amber (#F5B942) line-art on a deep navy background (#070B18). Show a clean binary syntax tree for the sentence "every student reads a book". Leaves read: every, student, reads, a, book. Faintly layered behind the tree, like translucent sheets, show four other analyses of the same sentence:
  - CCG categories: NP/N, N, (S\NP)/NP
  - a typed lambda term: λP.λQ.∀x(P(x) → Q(x))
  - dependency arcs labelled nsubj, obj, det
  - a small AMR graph: read-01 → :ARG0 student, :ARG1 book
Typography must be legible and correctly spelled. Use a monospace font for formulas.

MIDDLE ZONE: "Embedding". The tree's nodes detach and drift into a violet (#A78BFA) geometric vector space: a softly gridded 3-D coordinate frame. Each node becomes a point. Faint lines keep the tree topology, so the tree is still visible as a constellation. Near the points, small floating glyphs show "f ⊗ r" (tensor-product binding), and a translucent 6×6 heat-map matrix labelled "T = Σ fᵢ ⊗ rᵢ" is visible. A subtle caption reads "‖hᵢ − hⱼ‖² = d_tree(i, j)".

RIGHT ZONE: "Neural". A layered neural network in cyan (#38D9F5) with 4 columns of neurons (8, 8, 8, 4). Neurons glow with intensity proportional to activation. Some are cyan (positive) and some pink (#FF6B9A, negative). Connection lines brighten where signal flows. The particle stream from the embedding zone enters the first layer.

Style: elegant, minimal, high-contrast dark theme, like a figure from a top-tier ML/linguistics paper crossed with a planetarium visual. Flat vector look with gentle bloom and glow. No people, no robots, no brains, no stock-photo clichés, no random gibberish text. Lots of negative space at the top centre for a website headline.
```

**Variations to try:** "square 1:1 version for a social-media card"; "light background version (#FAFAF7) with the same palette, for a printed poster"; "remove all text except the three zone labels".

---

## Prompt B — interactive figure (Gemini Canvas / code generation)

```
Build a single self-contained HTML file (vanilla JS + SVG, no external libraries, no build step) that visualises neuro-symbolic embedding of linguistic theories into neural representations. Dark theme: background #070B18, symbolic = amber #F5B942, embedding = violet #A78BFA, neural = cyan #38D9F5, negative values = pink #FF6B9A. Fonts: Inter for text, JetBrains Mono for formulas.

DATA: one sentence, "every student reads a book", analysed in five theories. Encode each analysis as a tree with nodes {id, label, type/category, parent, detail}:
  1. CCG: S(<) → NP(>)[every:NP/N, student:N], S\NP(>)[reads:(S\NP)/NP, NP(>)[a:NP/N, book:N]]
  2. Montague: the same shape, with semantic types (t, (e→t)→t, e→t …) and λ-terms. Root: ∀x(student(x) → ∃y(book(y) ∧ read(x,y)))
  3. DisCoCat: the same shape, with pregroup types: every n·nˡ, student n, reads nʳ·s·nˡ, a n·nˡ, book n, root s
  4. Universal Dependencies: reads(root) → student(nsubj) → every(det); reads → book(obj) → a(det). Lay out x by word order.
  5. AMR: (r / read-01 :ARG0 (s / student :mod (e / every)) :ARG1 (b / book))

LAYOUT: three side-by-side panels, connected by animated dashed gradient curves.
  PANEL 1 "Symbolic": draw the selected tree. Leaves go on the bottom row for constituency trees, and labelled arcs are used for dependency and AMR.
  PANEL 2 "Embedding": compute the tree-distance matrix D (path length) and run classical MDS on D treated as SQUARED distances (B = −½ J D J; eigendecompose with a Jacobi solver). Place nodes at the top-2 coordinates, and keep tree edges as faint lines. Display the exact dimensionality, the % variance in the 2-D view, and max |‖hᵢ−hⱼ‖² − D_ij| (it should be ≈1e-12, because square roots of tree metrics are Euclidean). Caption: "‖hᵢ − hⱼ‖² = d_tree(i,j): the geometry a structural probe looks for".
  PANEL 3 "Neural": a seeded random-weight tanh MLP (8 → 8 → 8 → 4). The input is the full MDS vector, zero-padded. Colour neurons by activation (cyan +, pink −) and set edge opacity by |w·a|. Label it "illustrative random weights".

INTERACTION:
  - Theory tabs switch the analysis. All panels animate smoothly (≈400 ms).
  - Hovering a node in any panel highlights it everywhere and shows its type, λ-term or role, and its distance to other nodes in an info card.
  - Auto-cycle through the nodes every 2 s until the user hovers.
  - A second section, "Tensor-product binding": fillers = words/concepts, roles = structural paths (L·R… for constituency, nsubj·det… for dependency, :ARG0·:mod for AMR). Use seeded random unit vectors in ℝ⁶. Compute T = Σ fᵢ ⊗ rᵢ and show it as a 6×6 heat-map with values. The user picks a role. Show û = T·r, the true filler, and the cosine to every filler as bars. Add a toggle for "orthonormal roles (Gram–Schmidt)". When it is off, crosstalk appears and the cosines drop.

QUALITY BAR: every number shown must be computed live, not hard-coded. Responsive down to 900 px (panels stack). Respect prefers-reduced-motion. Use accessible labels. Clean, publication-quality look, with no emoji and no lorem ipsum.
```

---

### Tips
- For Prompt A, generate 4 to 6 candidates and pick the one with correct text. Image models often misspell formulas, so if the formulas come out wrong, ask for a "no-text" version and overlay the text in HTML/CSS.
- For Prompt B, ask Gemini to "verify the MDS error is < 1e-9 for all five theories" as a follow-up. This catches eigensolver bugs.
