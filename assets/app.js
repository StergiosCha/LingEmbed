/* LingEmbed — interactive visualisations.
 * Everything is computed in the browser:
 *  - tree layouts for five linguistic analyses of one sentence
 *  - an exact Euclidean embedding with ||h_i - h_j||^2 = d_tree(i,j) (classical MDS, Jacobi eigensolver)
 *  - a small random-weight tanh encoder (illustrative only)
 *  - tensor-product role/filler binding and unbinding
 */
(() => {
  'use strict';

  /* ---------- utilities ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function randn(rng) {
    let u = 0, v = 0;
    while (!u) u = rng();
    while (!v) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const randVec = (seed, d) => { const r = mulberry32(seed); return Array.from({ length: d }, () => randn(r)); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = a => Math.sqrt(dot(a, a));
  const scale = (a, k) => a.map(x => x * k);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const unit = a => scale(a, 1 / (norm(a) || 1));
  const cosine = (a, b) => dot(a, b) / ((norm(a) * norm(b)) || 1);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- theories: one sentence, five analyses ---------- */
  const THEORIES = {
    ccg: {
      short: 'Categorial Grammar', title: 'Combinatory Categorial Grammar', layout: 'constituency',
      blurb: 'Lexical categories are functions. The derivation is forward (>) and backward (<) application over a typed lexicon.',
      nodes: [
        { id: 'S', label: 'S', sub: '<', parent: null, detail: 'Backward application:  NP   S\\NP  ⇒  S' },
        { id: 'NP1', label: 'NP', sub: '>', parent: 'S', detail: 'Forward application:  NP/N   N  ⇒  NP' },
        { id: 'every', label: 'every', sub: 'NP/N', parent: 'NP1', word: true, detail: 'Determiner: takes an N on its right and yields an NP' },
        { id: 'student', label: 'student', sub: 'N', parent: 'NP1', word: true, detail: 'Common noun' },
        { id: 'VP', label: 'S\\NP', sub: '>', parent: 'S', detail: 'Forward application:  (S\\NP)/NP   NP  ⇒  S\\NP' },
        { id: 'reads', label: 'reads', sub: '(S\\NP)/NP', parent: 'VP', word: true, detail: 'Transitive verb: takes an NP on the right, then an NP on the left' },
        { id: 'NP2', label: 'NP', sub: '>', parent: 'VP', detail: 'Forward application:  NP/N   N  ⇒  NP' },
        { id: 'a', label: 'a', sub: 'NP/N', parent: 'NP2', word: true, detail: 'Determiner' },
        { id: 'book', label: 'book', sub: 'N', parent: 'NP2', word: true, detail: 'Common noun' }
      ]
    },
    hpsg: {
      short: 'HPSG', title: 'Head-driven Phrase Structure Grammar', layout: 'constituency',
      blurb: 'Signs are typed feature structures. A few phrase types (head-subject, head-complement, head-specifier) license the tree by unifying valence lists.',
      nodes: [
        { id: 'S', label: 'S', sub: 'hd-subj-ph', parent: null, detail: '[HEAD verb, SUBJ ⟨⟩, COMPS ⟨⟩]: the head daughter\'s SUBJ requirement is cancelled by the NP' },
        { id: 'NP1', label: 'NP', sub: 'hd-spr-ph', parent: 'S', detail: '[HEAD noun, SPR ⟨⟩]: the determiner saturates the noun\'s SPR list' },
        { id: 'every', label: 'every', sub: 'Det', parent: 'NP1', word: true, detail: '[HEAD det, SPEC N′], quantifier on the noun\'s CONT' },
        { id: 'student', label: 'student', sub: 'N[SPR⟨Det⟩]', parent: 'NP1', word: true, detail: '[HEAD noun, SPR ⟨Det⟩, COMPS ⟨⟩]' },
        { id: 'VP', label: 'VP', sub: 'hd-comp-ph', parent: 'S', detail: '[HEAD verb, SUBJ ⟨NP⟩, COMPS ⟨⟩]' },
        { id: 'reads', label: 'reads', sub: 'V[COMPS⟨NP⟩]', parent: 'VP', word: true, detail: '[HEAD verb, SUBJ ⟨NP₁⟩, COMPS ⟨NP₂⟩, CONT read(1, 2)]' },
        { id: 'NP2', label: 'NP', sub: 'hd-spr-ph', parent: 'VP', detail: '[HEAD noun, SPR ⟨⟩]' },
        { id: 'a', label: 'a', sub: 'Det', parent: 'NP2', word: true, detail: '[HEAD det, SPEC N′]' },
        { id: 'book', label: 'book', sub: 'N[SPR⟨Det⟩]', parent: 'NP2', word: true, detail: '[HEAD noun, SPR ⟨Det⟩, COMPS ⟨⟩]' }
      ]
    },
    minimalism: {
      short: 'Minimalism', title: 'Minimalist syntax', layout: 'constituency',
      blurb: 'Structure is built by binary Merge. The subject merges inside vP and moves to Spec,TP, leaving a lower copy (simplified tree).',
      nodes: [
        { id: 'TP', label: 'TP', sub: '', parent: null, detail: 'Spec,TP is filled by the moved subject (EPP)' },
        { id: 'DP1', label: 'DP', sub: '', parent: 'TP', detail: 'Subject DP after movement' },
        { id: 'every', label: 'every', sub: 'D', parent: 'DP1', word: true, detail: 'D head' },
        { id: 'student', label: 'student', sub: 'N', parent: 'DP1', word: true, detail: 'N complement of D' },
        { id: 'Tb', label: 'T′', sub: '', parent: 'TP', detail: 'T′ = Merge(T, vP)' },
        { id: 'T', label: 'T', sub: '[pres]', parent: 'Tb', detail: 'Tense head carrying present tense, valued on the verb' },
        { id: 'vP', label: 'vP', sub: '', parent: 'Tb', detail: 'Phase. The external argument is first merged here' },
        { id: 'copy', label: '⟨DP⟩', sub: 'copy', parent: 'vP', detail: 'Lower copy of the subject (copy theory of movement)' },
        { id: 'vb', label: 'v′', sub: '', parent: 'vP', detail: 'v′ = Merge(v+V, DP)' },
        { id: 'reads', label: 'reads', sub: 'v+V', parent: 'vb', word: true, detail: 'V raises to v. v introduces the external θ-role' },
        { id: 'DP2', label: 'DP', sub: '', parent: 'vb', detail: 'Object DP' },
        { id: 'a', label: 'a', sub: 'D', parent: 'DP2', word: true, detail: 'D head' },
        { id: 'book', label: 'book', sub: 'N', parent: 'DP2', word: true, detail: 'N complement of D' }
      ]
    },
    cxg: {
      short: 'Construction Grammar', title: 'Construction Grammar', layout: 'constituency',
      blurb: 'Form–meaning pairings at every size. The clause instantiates the transitive construction, whose slots are filled by smaller constructions.',
      nodes: [
        { id: 'TR', label: 'Transitive Cxn', sub: '[SBJ V OBJ] ↔ act(x, y)', parent: null, detail: 'Form: [SBJ V OBJ]. Meaning: an agent x acts on a patient y' },
        { id: 'NP1', label: 'Det-N Cxn', sub: 'quantified', rel: 'SBJ', parent: 'TR', detail: '[Det N] ↔ a quantified referent' },
        { id: 'every', label: 'every', sub: 'Det', rel: 'Det', parent: 'NP1', word: true, detail: 'Universal quantification' },
        { id: 'student', label: 'student', sub: 'N', rel: 'N', parent: 'NP1', word: true, detail: 'Noun construction' },
        { id: 'reads', label: 'reads', sub: 'V', rel: 'V', parent: 'TR', word: true, detail: 'Verb fusing with the transitive construction: reader = agent, read-thing = patient' },
        { id: 'NP2', label: 'Det-N Cxn', sub: 'indefinite', rel: 'OBJ', parent: 'TR', detail: '[Det N] ↔ an indefinite referent' },
        { id: 'a', label: 'a', sub: 'Det', rel: 'Det', parent: 'NP2', word: true, detail: 'Indefinite article' },
        { id: 'book', label: 'book', sub: 'N', rel: 'N', parent: 'NP2', word: true, detail: 'Noun construction' }
      ]
    },
    ds: {
      short: 'Dynamic Syntax', title: 'Dynamic Syntax', layout: 'constituency',
      blurb: 'The tree grows word by word, left to right. Each node carries a type requirement and an address (↓0 argument, ↓1 functor).',
      nodes: [
        { id: 'R', label: 'Ty(t)', sub: '◇', parent: null, detail: 'Fo(Read(ε, y, Book(y))(τ, x, Student(x))). All ?Ty(X) requirements are satisfied, so the tree is complete' },
        { id: 'SU', label: 'Ty(e)', sub: 'τ-term', rel: '↓0', parent: 'R', detail: 'Fo(τ, x, Student(x)): the universal as a τ-term (epsilon calculus)' },
        { id: 'every', label: 'every', sub: 'Ty(cn→e)', rel: '↓1', parent: 'SU', word: true, detail: 'The determiner is the functor daughter of the subject node' },
        { id: 'student', label: 'student', sub: 'Ty(cn)', rel: '↓0', parent: 'SU', word: true, detail: 'Fo(x, Student(x))' },
        { id: 'P', label: 'Ty(e→t)', sub: '', rel: '↓1', parent: 'R', detail: 'Predicate node, built once the verb is parsed' },
        { id: 'reads', label: 'reads', sub: 'Ty(e→(e→t))', rel: '↓1', parent: 'P', word: true, detail: 'The verb annotates the functor node and projects ?Ty(e) for its object' },
        { id: 'O', label: 'Ty(e)', sub: 'ε-term', rel: '↓0', parent: 'P', detail: 'Fo(ε, y, Book(y)): the indefinite as an ε-term' },
        { id: 'a', label: 'a', sub: 'Ty(cn→e)', rel: '↓1', parent: 'O', word: true, detail: 'Indefinite determiner' },
        { id: 'book', label: 'book', sub: 'Ty(cn)', rel: '↓0', parent: 'O', word: true, detail: 'Fo(y, Book(y))' }
      ]
    },
    mtt: {
      short: 'Type theory', title: 'Type-theoretic semantics (MTT)', layout: 'constituency',
      blurb: 'Common nouns are types and quantifiers are Π-typed. Coercive subtyping lets a Student count as a Human, and a Book as Phy•Info.',
      nodes: [
        { id: 'S', label: 'Prop', sub: '∀x:Student. ∃y:Book…', parent: null, detail: '∀x:Student. ∃y:Book. read(x, y)' },
        { id: 'NP1', label: '(Student→Prop)→Prop', sub: '', parent: 'S', detail: 'every(Student)' },
        { id: 'every', label: 'every', sub: 'ΠA:CN. …', parent: 'NP1', word: true, detail: 'every : ΠA:CN. (A → Prop) → Prop' },
        { id: 'student', label: 'student', sub: 'Student : CN', parent: 'NP1', word: true, detail: 'Common nouns as types: Student : CN, with Student ≤ Human' },
        { id: 'VP', label: 'Human→Prop', sub: '', parent: 'S', detail: 'λx:Human. ∃y:Book. read(x, y). It applies to students via Student ≤ Human' },
        { id: 'reads', label: 'reads', sub: 'Human→Phy•Info→Prop', parent: 'VP', word: true, detail: 'read : Human → Phy•Info → Prop' },
        { id: 'NP2', label: '(Book→Prop)→Prop', sub: '', parent: 'VP', detail: 'a(Book)' },
        { id: 'a', label: 'a', sub: 'ΠA:CN. …', parent: 'NP2', word: true, detail: 'a : ΠA:CN. (A → Prop) → Prop' },
        { id: 'book', label: 'book', sub: 'Book : CN', parent: 'NP2', word: true, detail: 'Book ≤ Phy•Info: a dot-type, so a book can be read and carried' }
      ]
    }
  };
  const ORDER = ['ccg', 'hpsg', 'minimalism', 'cxg', 'ds', 'mtt'];

  /* ---------- tree layout ---------- */
  function buildTree(th) {
    const nodes = th.nodes.map((n, i) => ({ ...n, idx: i, children: [] }));
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    nodes.forEach(n => { if (n.parent) byId[n.parent].children.push(n); });
    const root = nodes.find(n => !n.parent);
    (function depth(n, k) { n.depth = k; n.children.forEach(c => depth(c, k + 1)); })(root, 0);
    const maxD = Math.max(...nodes.map(n => n.depth));
    if (th.layout === 'dependency') {
      const mp = Math.max(...nodes.map(n => n.pos));
      nodes.forEach(n => { n.xi = n.pos / mp; });
    } else {
      const leaves = [];
      (function dfs(n) { if (!n.children.length) leaves.push(n); n.children.forEach(dfs); })(root);
      leaves.forEach((l, i) => { l.xi = leaves.length > 1 ? i / (leaves.length - 1) : 0.5; l.leafIdx = i; });
      (function post(n) {
        if (n.children.length) { n.children.forEach(post); n.xi = n.children.reduce((s, c) => s + c.xi, 0) / n.children.length; }
      })(root);
    }
    nodes.forEach(n => {
      n.yi = (th.layout === 'constituency' && !n.children.length) ? maxD : n.depth;
      n.yi = maxD ? n.yi / maxD : 0;
    });
    // role names: arc-label paths if available, else L/R child paths
    nodes.forEach(n => {
      const path = []; let cur = n;
      while (cur.parent) {
        const p = byId[cur.parent];
        if (th.nodes.some(x => x.rel)) path.unshift(cur.rel);
        else path.unshift(p.children.indexOf(cur) === 0 ? 'L' : 'R');
        cur = p;
      }
      n.role = path.length ? path.join('·') : 'root';
    });
    // undirected tree distances (BFS)
    const N = nodes.length;
    const adj = nodes.map(() => []);
    nodes.forEach(n => { if (n.parent) { const p = byId[n.parent]; adj[n.idx].push(p.idx); adj[p.idx].push(n.idx); } });
    const dist = nodes.map((_, s) => {
      const d = Array(N).fill(-1); d[s] = 0; const q = [s];
      while (q.length) { const u = q.shift(); adj[u].forEach(v => { if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } }); }
      return d;
    });
    return { nodes, byId, root, dist, adj, nLeaves: th.layout === 'dependency' ? 0 : nodes.filter(n => !n.children.length).length };
  }

  /* ---------- Jacobi eigen-decomposition (symmetric) ---------- */
  function jacobiEigen(A) {
    const n = A.length;
    const a = A.map(r => r.slice());
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { vals: a.map((r, i) => r[i]), V };
  }

  /* Classical MDS with squared target distances = tree distance.
     Square roots of tree metrics are Euclidean, so the embedding is exact in n−1 dims. */
  function treeEmbedding(dist) {
    const n = dist.length;
    const rowMean = dist.map(r => r.reduce((s, x) => s + x, 0) / n);
    const all = rowMean.reduce((s, x) => s + x, 0) / n;
    const B = dist.map((r, i) => r.map((d, j) => -0.5 * (d - rowMean[i] - rowMean[j] + all)));
    const { vals, V } = jacobiEigen(B);
    const order = vals.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
    const pos = order.filter(([v]) => v > 1e-9);
    const X = Array.from({ length: n }, (_, i) => pos.map(([v, k]) => V[i][k] * Math.sqrt(v)));
    const total = pos.reduce((s, [v]) => s + v, 0);
    const explained2 = pos.slice(0, 2).reduce((s, [v]) => s + v, 0) / total;
    let maxErr = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const d2 = dot(sub(X[i], X[j]), sub(X[i], X[j]));
      maxErr = Math.max(maxErr, Math.abs(d2 - dist[i][j]));
    }
    return { X, dims: pos.length, explained2, maxErr };
  }

  /* ---------- illustrative random encoder ---------- */
  const LAYERS = [8, 8, 8, 4];
  function makeEncoder(seed) {
    const rng = mulberry32(seed);
    const W = [];
    for (let l = 1; l < LAYERS.length; l++) {
      W.push(Array.from({ length: LAYERS[l] }, () => Array.from({ length: LAYERS[l - 1] }, () => randn(rng) * 1.3 / Math.sqrt(LAYERS[l - 1]))));
    }
    return W;
  }
  function forward(W, x) {
    const acts = [x.slice(0, LAYERS[0]).concat(Array(Math.max(0, LAYERS[0] - x.length)).fill(0))];
    W.forEach(M => { const prev = acts[acts.length - 1]; acts.push(M.map(row => Math.tanh(dot(row, prev)))); });
    return acts;
  }

  /* ---------- colour helpers ---------- */
  function divColor(v) { // v in [-1,1]
    const a = Math.min(1, Math.abs(v));
    return v >= 0 ? `rgba(56,217,245,${0.12 + 0.88 * a})` : `rgba(255,107,154,${0.12 + 0.88 * a})`;
  }

  /* ---------- pipeline view ---------- */
  const svg = $('#pipelineSvg');
  const P = {
    tree: { x: 16, y: 70, w: 478, h: 390 },
    emb: { x: 510, y: 70, w: 325, h: 390 },
    neu: { x: 851, y: 70, w: 333, h: 390 }
  };
  let state = { theory: 'ccg', active: 0, paused: false };
  let model = null;

  function compute(key) {
    const th = THEORIES[key];
    const T = buildTree(th);
    const E = treeEmbedding(T.dist);
    const W = makeEncoder(hashStr('enc:' + key));
    const acts = E.X.map(x => forward(W, x));
    return { key, th, T, E, W, acts };
  }

  function render() {
    model = compute(state.theory);
    const { th, T, E, W } = model;
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const g1 = el('linearGradient', { id: 'gSymEmb', x1: '0', x2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#f5b942' }, g1); el('stop', { offset: '1', 'stop-color': '#a78bfa' }, g1);
    const g2 = el('linearGradient', { id: 'gEmbNeu', x1: '0', x2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#a78bfa' }, g2); el('stop', { offset: '1', 'stop-color': '#38d9f5' }, g2);

    const heads = [
      [P.tree, 'symbolic', '#f5b942', th.short + ' analysis'],
      [P.emb, 'embedding', '#a78bfa', '‖hᵢ − hⱼ‖² = d_tree(i, j)'],
      [P.neu, 'neural', '#38d9f5', 'tanh encoder · 8 → 8 → 8 → 4']
    ];
    heads.forEach(([p, t, c, s]) => {
      el('rect', { x: p.x, y: p.y - 50, width: p.w, height: p.h + 60, rx: 14, class: 'panel-bg' }, svg);
      const tt = el('text', { x: p.x + 16, y: p.y - 26, class: 'panel-title', fill: c }, svg); tt.textContent = t;
      const ss = el('text', { x: p.x + 16, y: p.y - 10, class: 'panel-sub' }, svg); ss.textContent = s;
    });

    const linkLayer = el('g', {}, svg);

    // tree
    const tp = { x: P.tree.x + 52, y: P.tree.y + 34, w: P.tree.w - 104, h: P.tree.h - 110 };
    T.nodes.forEach(n => { n.px = tp.x + n.xi * tp.w; n.py = tp.y + n.yi * tp.h; });
    const gt = el('g', {}, svg);
    T.nodes.forEach(n => {
      if (!n.parent) return;
      const p = T.byId[n.parent];
      if (th.layout === 'dependency') {
        el('path', { d: `M${p.px},${p.py} C${p.px},${(p.py + n.py) / 2} ${n.px},${(p.py + n.py) / 2} ${n.px},${n.py}`, class: 't-edge' }, gt);
      } else {
        el('line', { x1: p.px, y1: p.py, x2: n.px, y2: n.py, class: 't-edge' }, gt);
      }
      if (n.rel && n.rel !== 'root') {
        const r = el('text', { x: (p.px + n.px) / 2 + (n.px < p.px ? -14 : 14), y: (p.py + n.py) / 2 - 2, 'text-anchor': 'middle', fill: '#8c98b8', 'font-family': 'JetBrains Mono, monospace', 'font-size': '10' }, gt);
        r.textContent = n.rel;
      }
    });
    T.nodes.forEach(n => {
      const g = el('g', { class: 't-node' + (n.word ? ' word' : ''), 'data-i': n.idx, transform: `translate(${n.px},${n.py})` }, gt);
      el('circle', { r: 8 }, g);
      const below = !n.children.length || th.layout !== 'constituency';
      const stag = (below && n.leafIdx !== undefined && T.nLeaves > 3 && n.leafIdx % 2 === 1) ? 26 : 0;
      const lab = el('text', { class: 'lab', y: below ? 24 + stag : -14 }, g); lab.textContent = n.label;
      if (n.sub) { const sb = el('text', { class: 'sub', y: below ? 38 + stag : -28 }, g); sb.textContent = n.sub; }
      g.addEventListener('mouseenter', () => setActive(n.idx, true));
    });

    // embedding
    const ep = { x: P.emb.x + 46, y: P.emb.y + 26, w: P.emb.w - 92, h: P.emb.h - 80 };
    const xs = E.X.map(v => v[0] || 0), ys = E.X.map(v => v[1] || 0);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const s = Math.min(ep.w, ep.h) / span;
    T.nodes.forEach((n, i) => { n.ex = ep.x + ep.w / 2 + (xs[i] - cx) * s; n.ey = ep.y + ep.h / 2 + (ys[i] - cy) * s; });
    const ge = el('g', {}, svg);
    el('circle', { cx: ep.x + ep.w / 2, cy: ep.y + ep.h / 2, r: Math.min(ep.w, ep.h) / 2 + 10, class: 'e-ring' }, ge);
    T.nodes.forEach(n => { if (n.parent) { const p = T.byId[n.parent]; el('line', { x1: p.ex, y1: p.ey, x2: n.ex, y2: n.ey, class: 'e-edge' }, ge); } });
    T.nodes.forEach(n => {
      const c = el('circle', { cx: n.ex, cy: n.ey, r: n.word ? 7 : 5.5, class: 'e-pt' + (n.word ? ' word' : ''), 'data-i': n.idx }, ge);
      c.addEventListener('mouseenter', () => setActive(n.idx, true));
      const t = el('text', { x: n.ex + 10, y: n.ey - 8, class: 'e-lab' }, ge); t.textContent = n.label;
    });
    const note = el('text', { x: P.emb.x + 16, y: P.emb.y + P.emb.h, class: 'panel-sub' }, svg);
    note.textContent = `exact in ${E.dims}D · top-2 PCs shown (${(E.explained2 * 100).toFixed(0)}% var.)`;

    // neural
    const np = { x: P.neu.x + 40, y: P.neu.y + 22, w: P.neu.w - 80, h: P.neu.h - 76 };
    const cols = LAYERS.map((m, l) => np.x + (l / (LAYERS.length - 1)) * np.w);
    const pos = LAYERS.map((m, l) => Array.from({ length: m }, (_, j) => [cols[l], np.y + ((j + 0.5) / m) * np.h]));
    model.npos = pos;
    const gn = el('g', {}, svg);
    model.edgeEls = [];
    W.forEach((M, l) => {
      const layer = [];
      M.forEach((row, j) => row.forEach((w, i) => {
        const [x1, y1] = pos[l][i], [x2, y2] = pos[l + 1][j];
        layer.push({ e: el('line', { x1, y1, x2, y2, class: 'n-edge', 'stroke-opacity': 0.05 }, gn), i, j, w });
      }));
      model.edgeEls.push(layer);
    });
    model.nodeEls = pos.map(layer => layer.map(([x, y]) => el('circle', { cx: x, cy: y, r: 9, class: 'n-node', fill: 'rgba(255,255,255,.05)' }, gn)));
    ['h ∈ ℝ⁸', 'layer 1', 'layer 2', 'out'].forEach((t, l) => {
      const tt = el('text', { x: cols[l], y: np.y + np.h + 26, class: 'n-lab' }, gn); tt.textContent = t;
    });

    model.linkLayer = linkLayer;
    model.ep = ep;
    renderInfoTheory();
    setActive(Math.min(state.active, T.nodes.length - 1), false);
    renderBinding();
  }

  function setActive(i, fromUser) {
    if (fromUser) state.paused = true;
    state.active = i;
    const { T, acts, linkLayer, npos, E } = model;
    svg.querySelectorAll('.t-node').forEach(g => g.classList.toggle('active', +g.dataset.i === i));
    svg.querySelectorAll('.e-pt').forEach(c => c.classList.toggle('active', +c.dataset.i === i));
    const a = acts[i];
    model.nodeEls.forEach((layer, l) => layer.forEach((c, j) => {
      const v = l === 0 ? a[0][j] / 1.2 : a[l][j];
      c.setAttribute('fill', divColor(v));
    }));
    model.edgeEls.forEach((layer, l) => layer.forEach(({ e, i: src, w }) => {
      const flow = Math.abs(w * (l === 0 ? a[0][src] : a[l][src]));
      e.setAttribute('stroke-opacity', Math.min(0.85, 0.04 + flow * 0.9).toFixed(3));
    }));
    linkLayer.innerHTML = '';
    const n = T.nodes[i];
    el('path', { d: `M${n.px},${n.py} C${(n.px + n.ex) / 2 + 40},${n.py} ${(n.px + n.ex) / 2 - 40},${n.ey} ${n.ex},${n.ey}`, class: 'link', stroke: 'url(#gSymEmb)' }, linkLayer);
    const [ix, iy] = [npos[0][0][0], npos[0][Math.floor(npos[0].length / 2)][1]];
    el('path', { d: `M${n.ex},${n.ey} C${(n.ex + ix) / 2 + 40},${n.ey} ${(n.ex + ix) / 2 - 40},${iy} ${ix - 12},${iy}`, class: 'link', stroke: 'url(#gEmbNeu)' }, linkLayer);
    renderInfoNode(n, a, E);
  }

  function renderInfoTheory() {
    const { th, E, T } = model;
    $('#infoTheory').innerHTML = `<h5>theory</h5><div class="big">${esc(th.title)}</div><p style="margin:.3em 0 0;color:#c3cbe0">${esc(th.blurb)}</p>`;
    $('#infoGeom').innerHTML = `<h5>geometry check</h5>
      <div class="kv"><span>nodes</span><span>${T.nodes.length}</span></div>
      <div class="kv"><span>embedding dims (exact)</span><span>${E.dims}</span></div>
      <div class="kv"><span>max |‖Δh‖² − d_tree|</span><span>${E.maxErr.toExponential(1)}</span></div>
      <div class="kv"><span>variance in 2-D view</span><span>${(E.explained2 * 100).toFixed(1)}%</span></div>
      <p style="margin:.6em 0 0;color:#8c98b8;font-size:.82rem">A structural probe (Hewitt &amp; Manning, 2019) searches a model's hidden states for a linear map with exactly this property.</p>`;
  }

  function renderInfoNode(n, a, E) {
    const others = model.T.nodes.filter(m => m.idx !== n.idx)
      .map(m => `${esc(m.label)}:${model.T.dist[n.idx][m.idx]}`).slice(0, 8).join('  ');
    const out = a[a.length - 1].map(v => v.toFixed(2)).join(', ');
    $('#infoNode').innerHTML = `<h5>selected node</h5>
      <div class="big">${esc(n.label)} <span class="muted mono" style="font-size:.8rem">${esc(n.sub)}</span></div>
      <code>${esc(n.detail)}</code>
      <div class="kv" style="margin-top:8px"><span>role</span><span>${esc(n.role)}</span></div>
      <div class="kv"><span>d_tree to others</span><span style="font-size:.74rem">${others}</span></div>
      <div class="kv"><span>encoder output</span><span>[${out}]</span></div>`;
  }

  function renderTabs() {
    const tabs = $('#theoryTabs');
    tabs.innerHTML = '';
    ORDER.forEach(k => {
      const b = document.createElement('button');
      b.className = 'tab' + (k === state.theory ? ' active' : '');
      b.textContent = THEORIES[k].short;
      b.setAttribute('role', 'tab');
      b.onclick = () => { state.theory = k; state.active = 0; renderTabs(); render(); };
      tabs.appendChild(b);
    });
  }

  // auto-cycle through nodes until the user interacts
  svg.addEventListener('mouseleave', () => { state.paused = false; });
  setInterval(() => {
    if (state.paused || !model || document.hidden) return;
    setActive((state.active + 1) % model.T.nodes.length, false);
  }, 2200);

  /* ---------- tensor product binding ---------- */
  const D = 6;
  let bindState = { ortho: true, query: 0 };
  function gramSchmidt(vs) {
    const out = [];
    vs.forEach(v => { let w = v.slice(); out.forEach(u => { w = sub(w, scale(u, dot(w, u))); }); out.push(unit(w)); });
    return out;
  }
  function renderBinding() {
    const { T } = model;
    const items = T.nodes.filter(n => n.word);
    const fillers = items.map(n => unit(randVec(hashStr('filler:' + n.label), D)));
    let roles = items.map(n => unit(randVec(hashStr('role:' + n.role), D)));
    if (bindState.ortho) roles = gramSchmidt(roles);
    const Tm = Array.from({ length: D }, (_, i) => Array.from({ length: D }, (_, j) => items.reduce((s, _, k) => s + fillers[k][i] * roles[k][j], 0)));
    bindState.query = Math.min(bindState.query, items.length - 1);

    $('#bindCount').textContent = `(${items.length} filler ⊗ role pairs)`;
    $('#bindList').innerHTML = items.map(n => `<li><span class="f">${esc(n.label)}</span><span class="op">⊗</span><span class="r">${esc(n.role)}</span></li>`).join('');
    const mx = Math.max(...Tm.flat().map(Math.abs)) || 1;
    $('#heatT').innerHTML = Tm.flat().map(v => `<div style="background:${divColor(v / mx)}">${v.toFixed(1)}</div>`).join('');

    const rb = $('#roleBtns');
    rb.innerHTML = '';
    items.forEach((n, k) => {
      const b = document.createElement('button');
      b.textContent = n.role;
      if (k === bindState.query) b.className = 'active';
      b.onclick = () => { bindState.query = k; renderBinding(); };
      rb.appendChild(b);
    });

    const k = bindState.query;
    const u = Tm.map(row => dot(row, roles[k]));
    const sims = fillers.map(f => cosine(u, f));
    const best = sims.indexOf(Math.max(...sims));
    const vrow = v => `<div class="vecrow">${v.map(x => `<div style="background:${divColor(x / 0.9)}" title="${x.toFixed(3)}"></div>`).join('')}</div>`;
    $('#unbindOut').innerHTML = `
      <div class="formula">T · r<sub>${esc(items[k].role)}</sub> = û &nbsp;→&nbsp; nearest filler: <b style="color:var(--sym)">${esc(items[best].label)}</b>${best === k ? ' ✓' : ' ✗'}</div>
      <div class="vec-label">recovered û</div>${vrow(u)}
      <div class="vec-label">true filler f<sub>${esc(items[k].label)}</sub></div>${vrow(fillers[k])}
      <div class="vec-label" style="margin-bottom:6px">cosine(û, f) for every filler</div>
      <div class="bars">${items.map((n, j) => `<span class="${j === best ? 'best' : ''}">${esc(n.label)}</span><div class="bar"><i style="width:${Math.max(0, sims[j]) * 100}%"></i></div><span class="${j === best ? 'best' : ''}">${sims[j].toFixed(3)}</span>`).join('')}</div>`;
  }
  $('#orthoToggle').addEventListener('change', e => { bindState.ortho = e.target.checked; renderBinding(); });

  /* ---------- hero background ---------- */
  function background() {
    const c = $('#bg'), ctx = c && c.getContext && c.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, pts;
    const rng = mulberry32(7);
    function init() {
      W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio;
      const n = Math.round(Math.min(90, innerWidth / 16));
      pts = Array.from({ length: n }, () => ({ x: rng() * W, y: rng() * H, vx: (rng() - .5) * .25, vy: (rng() - .5) * .25 }));
    }
    function col(x, a) { const t = x / W; const r = Math.round(245 * (1 - t) + 56 * t), g = Math.round(185 * (1 - t) + 217 * t), b = Math.round(66 * (1 - t) + 245 * t); return `rgba(${r},${g},${b},${a})`; }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      const R = 140 * devicePixelRatio;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
          if (d < R) { ctx.strokeStyle = col((p.x + q.x) / 2, 0.22 * (1 - d / R)); ctx.lineWidth = devicePixelRatio; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        ctx.fillStyle = col(p.x, 0.7); ctx.beginPath(); ctx.arc(p.x, p.y, 1.8 * devicePixelRatio, 0, 7); ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    addEventListener('resize', init);
    init(); frame();
  }

  // expose for testing
  window.LingEmbed = { THEORIES, buildTree, treeEmbedding, jacobiEigen };

  renderTabs();
  render();
  try { background(); } catch (e) { /* decorative only */ }
})();
