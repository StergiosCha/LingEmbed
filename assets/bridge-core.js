/* Versioned workbench import and deterministic representation diagnostics.
 * This module has no DOM, network access, learned weights, or parser dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LingEmbedBridge = api;
})(globalThis, function () {
  'use strict';
  const SCHEMA = 'lingembed.analysis.v1', MAX_BYTES = 8 * 1024 * 1024;
  const fail = message => { throw new Error(message); };
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const str = value => typeof value === 'string' && value.length <= 20000;
  const stable = value => JSON.stringify(canonical(value));
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  }
  function validate(bundle) {
    if (!record(bundle) || bundle.schema !== SCHEMA) fail('Expected a lingembed.analysis.v1 export.');
    if (new TextEncoder().encode(JSON.stringify(bundle)).length > MAX_BYTES) fail('Export exceeds 8 MiB.');
    if (!record(bundle.source) || !str(bundle.source.engine) || !str(bundle.source.analysis_sha256)) fail('Missing source provenance.');
    if (!record(bundle.observation) || !str(bundle.observation.text) || !str(bundle.observation.left_context)) fail('Missing observation.');
    if (!str(bundle.status) || typeof bundle.supported !== 'boolean' || typeof bundle.complete !== 'boolean') fail('Missing coverage status.');
    if (!record(bundle.projection) || !Array.isArray(bundle.projection.preserves) || !Array.isArray(bundle.projection.omits)
        || ![...bundle.projection.preserves, ...bundle.projection.omits].every(str)
        || !str(bundle.projection.selection) || !str(bundle.projection.verification)) fail('Missing projection contract.');
    if (!Array.isArray(bundle.tokens) || bundle.tokens.length > 80 || !Array.isArray(bundle.frames) || bundle.frames.length > 81) fail('Invalid trace length.');
    bundle.tokens.forEach((token, i) => {
      if (!record(token) || token.index !== i || !str(token.text) || typeof token.context !== 'boolean') fail('Invalid native token alignment.');
    });
    let observed = [], completed = false, totalNodes = 0;
    bundle.frames.forEach((frame, index) => {
      if (!record(frame) || frame.index !== index || !['word', 'completion'].includes(frame.stage)
          || !str(frame.word) || typeof frame.context !== 'boolean' || ![true, false, null].includes(frame.accepted)
          || !Array.isArray(frame.observed) || !frame.observed.every(str) || !record(frame.native_state)) fail('Invalid prefix frame.');
      if (completed) fail('Completion must be the last frame.');
      if (frame.stage === 'word') {
        const token = bundle.tokens[index];
        if (!token || token.text !== frame.word || token.context !== frame.context) fail('Frame/token mismatch.');
        observed = [...observed, frame.word];
      } else {
        completed = true;
        if (frame.word !== '' || index === 0) fail('Invalid completion frame.');
      }
      if (stable(observed) !== stable(frame.observed)) fail('A prefix contains missing or future words.');
      if (!Array.isArray(frame.structures) || frame.structures.length > 8
          || !Number.isInteger(frame.available_structures) || !Number.isInteger(frame.omitted_structures)
          || frame.omitted_structures < 0
          || frame.available_structures !== frame.structures.length + frame.omitted_structures) fail('Invalid alternative counts.');
      const structureIds = new Set();
      frame.structures.forEach(structure => {
        if (!record(structure) || !str(structure.id) || structureIds.has(structure.id)
            || !['ds-address-tree', 'ccg-derivation'].includes(structure.kind)
            || !str(structure.root) || !Array.isArray(structure.nodes) || !structure.nodes.length
            || structure.nodes.length > 256 || !Array.isArray(structure.edges) || structure.edges.length > 512) fail('Invalid or oversized structure.');
        structureIds.add(structure.id);
        totalNodes += structure.nodes.length;
        if (totalNodes > 20000) fail('Too many nodes in this export.');
        const ids = new Set();
        structure.nodes.forEach(node => {
          if (!record(node) || !str(node.id) || !node.id || ids.has(node.id) || !str(node.label)
              || !str(node.type) || !str(node.meaning) || !Array.isArray(node.labels) || !node.labels.every(str)) fail('Invalid or duplicate node.');
          ids.add(node.id);
          if (node.span !== null && (!Array.isArray(node.span) || node.span.length !== 2
              || !node.span.every(Number.isInteger) || node.span[0] < 0 || node.span[0] >= node.span[1]
              || node.span[1] > observed.length)) fail('Node span extends beyond the observed prefix.');
        });
        if (!ids.has(structure.root)) fail('Missing root node.');
        const edgeIds = new Set();
        structure.edges.forEach(edge => {
          const key = stable(edge);
          if (!record(edge) || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target
              || !str(edge.role) || !(edge.order === null || (Number.isInteger(edge.order) && edge.order >= 0))
              || edgeIds.has(key)) fail('Invalid or duplicate edge.');
          edgeIds.add(key);
        });
        // These adapters export trees. Reentrant graphs need a separate adapter
        // and must not be silently assigned the tree-metric geometry.
        treeEmbedding(structure);
      });
    });
    if (bundle.tokens.length !== bundle.frames.filter(f => f.stage === 'word').length) fail('Unmatched native tokens.');
    return bundle;
  }
  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) fail('Export exceeds 8 MiB.');
    return validate(JSON.parse(text));
  }
  function treeEmbedding(structure) {
    const nodes = structure.nodes, n = nodes.length;
    const index = new Map(nodes.map((node, i) => [node.id, i]));
    const root = index.get(structure.root), children = nodes.map(() => []), parents = new Set();
    if (root === undefined || structure.edges.length !== n - 1) fail('Tree geometry requires a connected tree.');
    structure.edges.forEach((edge, dimension) => {
      const from = index.get(edge.source), to = index.get(edge.target);
      if (from === undefined || to === undefined || parents.has(to) || to === root) fail('Tree geometry does not support reentrancy or cycles.');
      parents.add(to); children[from].push({to, dimension});
    });
    const vectors = nodes.map(() => Array(Math.max(0, n - 1)).fill(0));
    const depth = Array(n).fill(0), seen = new Set([root]), queue = [root];
    for (let q = 0; q < queue.length; q++) {
      const from = queue[q];
      children[from].forEach(({to, dimension}) => {
        if (seen.has(to)) fail('Tree geometry does not support cycles.');
        seen.add(to); queue.push(to); depth[to] = depth[from] + 1;
        vectors[to] = vectors[from].slice(); vectors[to][dimension] = 1;
      });
    }
    if (seen.size !== n) fail('Tree geometry requires a connected tree.');
    // Independent shortest-path check, not a comparison with the encoder's own formula.
    const adjacency = nodes.map(() => []);
    structure.edges.forEach(edge => {
      const a = index.get(edge.source), b = index.get(edge.target);
      adjacency[a].push(b); adjacency[b].push(a);
    });
    let maxError = 0;
    const distances = adjacency.map((_, start) => {
      const dist = Array(n).fill(-1), pending = [start]; dist[start] = 0;
      for (let q = 0; q < pending.length; q++) adjacency[pending[q]].forEach(to => {
        if (dist[to] === -1) {dist[to] = dist[pending[q]] + 1; pending.push(to);}
      });
      dist.forEach((value, j) => {
        const squared = vectors[start].reduce((sum, x, k) => sum + (x - vectors[j][k]) ** 2, 0);
        maxError = Math.max(maxError, Math.abs(squared - value));
      });
      return dist;
    });
    return {vectors, distances, depth, dimensions: Math.max(0, n - 1), maxError};
  }
  function payloads(structure) {
    return structure.nodes.map(node => ({node, outgoing: structure.edges.filter(e => e.source === node.id)}));
  }
  function bindingExperiment(structure, overlap = 0) {
    if (!Number.isFinite(overlap) || overlap < 0 || overlap > 1) fail('Role overlap must be between zero and one.');
    const values = payloads(structure), n = values.length;
    if (!n || n > 256) fail('Binding diagnostic supports 1–256 nodes.');
    // Each full, typed node/edge record is one categorical filler. The explicit
    // dictionary is side information, not a learned semantic embedding.
    // r_i = sqrt(1-rho)e_i + sqrt(rho)e_shared; r_i·r_j = rho for i != j.
    const roles = values.map((_, i) => Array.from({length: n + 1}, (_, j) => j === i ? Math.sqrt(1 - overlap) : j === n ? Math.sqrt(overlap) : 0));
    // One-hot fillers make row i of T = sum_i f_i outer r_i equal to r_i.
    const tensor = roles.map(row => row.slice());
    const recovered = roles.map(role => tensor.map(row => row.reduce((sum, x, j) => sum + x * role[j], 0)));
    let correct = 0, ties = 0, maxError = 0;
    const decoded = recovered.map((vector, i) => {
      vector.forEach((x, j) => {maxError = Math.max(maxError, Math.abs(x - Number(i === j)));});
      const maximum = Math.max(...vector), candidates = vector.map((x, j) => Math.abs(x - maximum) < 1e-10 ? j : -1).filter(j => j >= 0);
      if (candidates.length !== 1) {ties++; return null;}
      if (candidates[0] === i) correct++;
      return values[candidates[0]];
    });
    const reconstruction = decoded.every(Boolean) ? {nodes: decoded.map(v => v.node), edges: decoded.flatMap(v => v.outgoing)} : null;
    const signature = value => stable({nodes: [...value.nodes].sort((a,b) => a.id.localeCompare(b.id)),
                                      edges: [...value.edges].sort((a,b) => stable(a).localeCompare(stable(b)))});
    return {overlap, nodes: n, roleDimensions: n + 1, fillerDimensions: n,
            correct, ties, accuracy: correct / n, maxError,
            exactVectors: maxError < 1e-10,
            reconstructedRecords: reconstruction !== null && signature(reconstruction) === signature(structure),
            reconstruction,
            scope: 'Categorical codebook and role keys are supplied. Recovery covers node/edge records, not executable semantics or a trained model.'};
  }
  function sweep(structure) {
    return [0, .25, .5, .75, 1].map(overlap => {
      const {reconstruction, ...result} = bindingExperiment(structure, overlap);
      return result;
    });
  }
  return {SCHEMA, MAX_BYTES, validate, parse, stable, treeEmbedding, bindingExperiment, sweep};
});
