# DS Workbench bridge · version 1

The `workbench.html` page imports actual native parser traces and computes
representation diagnostics in the browser. It is independent of the workshop
homepage and its authored theory illustrations. No model key is needed.

## Run and use

In the DS Workbench checkout:

```sh
.venv/bin/ds-workbench --port 8770
```

In the LingEmbed checkout, using an available Python installation:

```sh
python3 -m http.server 8781 --bind 127.0.0.1
```

Open `http://127.0.0.1:8770/experiments.html`, run a comparison and choose
**Open in LingEmbed** on a prime, filler or target. The connection address is
editable under **LingEmbed connection**. Its default is
`http://127.0.0.1:8781/workbench.html`.

Alternatively, download that event's **LingEmbed JSON**, open
`http://127.0.0.1:8781/workbench.html` and import the file. Three bundled examples
work without running DS Workbench: English DS, Greek DS and independent CCG.
Select words or use the replay controls; a separate Completion step shows DS
post-input completion when it changes the tree. CCG alternatives can be selected.

## Shared contract: `lingembed.analysis.v1`

The Python producer is `dylan.experiments.lingembed.export_analysis`; the browser
consumer is `assets/bridge-core.js`. The contract is a representation projection,
not a common grammar ontology or an executable parser serialization.

| Field | Meaning |
| --- | --- |
| `schema` | Exact version string `lingembed.analysis.v1` |
| `source` | Engine ID, adapter version/source hash, original analysis hash and available grammar/implementation fingerprints |
| `observation` | Original text, supplied left context and task |
| `status`, `supported`, `complete` | Outcome for the entire observation; an unknown word is a coverage failure |
| `tokens` | Recorded native tokens, consecutive zero-based index and context flag; native tokenization may lowercase text |
| `frames` | Ordered recorded states; word frames followed optionally by a separate DS completion frame |
| `projection` | Explicit preserved/omitted information, alternative selection and verification method |

Each frame has its index, stage (`word` or `completion`), native word, context
flag, acceptance flag, observed prefix, copied `native_state`, exported
`structures`, and available/omitted structure counts. Each structure has:

```text
id, kind, root,
nodes: [{id, label, type, meaning, labels, span}],
edges: [{source, target, role, order}],
metadata
```

Node IDs are unique inside a structure; they are not asserted to identify the
same linguistic object across frames or different theories. A CCG span is a
half-open native token interval including supplied context. DS semantic nodes
have `span: null`: lexical alignment is not inferred from string similarity.
Types, labels and normalized meanings are retained as strings, not parsed into
a new semantic theory. The copied native state contains additional engine data.

Currently supported structure kinds:

- `ds-address-tree`: the selected native state, with all labels and address-step
  edges including LINK/unfixed steps. Address topology is not constituency.
  Word frames precede any explicit post-input completion.
- `ccg-derivation`: a native full-prefix derivation, with categories, normalized
  meaning strings, rules, ordered children and token spans. The adapter replays
  the same lexicon and implementation against every recorded before/after chart
  state. It retains the first eight derivations per prefix in native chart order,
  reporting omissions; that order is not a probability ranking. A prefix with
  no full-span derivation has no invented tree, but retains its chart summary.

The viewer validates schema, tokens, prefixes, spans, references and connected
tree topology. It rejects reentrancy rather than silently flattening graphs.
Import bounds are 8 MiB, 80 tokens, 81 frames, eight structures per frame,
256 nodes per structure and 20,000 nodes per export. These are viewer limits,
not cognitive constraints. Future LFG/feature/AMR adapters need appropriate graph
contracts and encoders. DS and CCG grammar/search bounds still apply upstream.

## What the checks establish

**Geometry:** each edge gets a coordinate; a node's vector has value 1 on the
edges in its root path. Squared Euclidean distances exactly equal unweighted
tree distances. An independent shortest-path calculation checks this equality.
The geometry omits node meanings, types, labels and edge roles. Identical topology
can therefore produce identical geometry under different linguistic analyses.
Coordinates are constructed afresh per structure and are not shared pretrained
embeddings or evidence about neural representations.

**Typed-record binding:** each node together with its outgoing edges is a
categorical filler in an explicit one-hot codebook. With `n` records, role vectors
have `n+1` dimensions:

```text
r_i = sqrt(1-rho) e_i + sqrt(rho) e_shared
T = sum_i f_i outer r_i
query_i = T r_i
```

Roles have norm 1 and different roles have dot product `rho`. At zero overlap,
queries recover filler vectors exactly. The same maximum-component decoder and
codebook are used at all five overlap settings. Ties are failures to identify a
unique filler, not silently resolved successes. The check compares reconstructed
node/edge records, including types and meanings, with the originals. Source
metadata, executable semantics, parser transitions and search alternatives are
outside this reconstruction claim.

Vector distortion and decoded-record failure are distinct outcomes. Intermediate
overlap can distort vectors while preserving the uniquely largest component.
At complete overlap all multi-node queries tie. This is a deterministic binding
diagnostic with supplied dictionaries and role keys. It does not compress the
structure into a fixed resource budget, fit human memory, predict reaction times,
train a neural network or intervene on an LLM. The exported diagnostic records
the source, state, selected structure, dimensions, parameters and all sweep rows.

## Transfer and hosting

The one-click transfer uses `postMessage` with an exact target origin, an exact
opener window and a fresh random channel. Both sides validate the handshake;
the viewer validates the payload and acknowledges successful loading. Transfers
expire after 15 seconds. Sentence content and model credentials are never put
in URLs; imports are not sent to a backend or persisted in local storage.

The viewer is static and can run on GitHub Pages after publication. Point the
workbench at that deployed `workbench.html` URL. Parsing remains with DS Workbench;
GitHub Pages does not run Python. The new page has not been published as part of
this implementation. Local file import does not need cross-origin API access.

## Verification and example regeneration

```sh
node --test tests/bridge-core.test.cjs
```

From the companion DS Workbench checkout:

```sh
.venv/bin/python scripts/export_lingembed_examples.py --output ../LingEmbed/examples
.venv/bin/pytest -q tests/test_experiment_lingembed.py
python scripts/check_lingembed_browser.py
```

The browser checker needs Playwright/Chromium and both local servers. The examples
were generated by the inherited DyLan-based DS engine and the workbench's bounded
CCG fragment; their embedded source fingerprints preserve that provenance. They
are parser outputs, not human data or gold-standard benchmark annotations.

Next useful extension: a fixed-budget representation/memory component in the
experiment host, with comparable codebook assumptions and held-out task data.
The current diagnostics do not change the host's memory or RT predictions.
