const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../assets/bridge-core.js');
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples', name + '.json'), 'utf8'));

test('native English, Greek and CCG exports validate and recover every exported node/edge record', () => {
  for (const name of ['ds-english','ds-greek','ccg-english']) {
    const bundle = core.validate(fixture(name));
    for (const frame of bundle.frames) for (const structure of frame.structures) {
      assert.equal(core.treeEmbedding(structure).maxError, 0);
      const result = core.bindingExperiment(structure, 0);
      assert.equal(result.exactVectors, true); assert.equal(result.reconstructedRecords, true);
      assert.equal(result.correct, structure.nodes.length);
    }
  }
});

test('geometry cannot distinguish a change of semantic type or edge label, while record encoding does', () => {
  const original = fixture('ccg-english').frames.at(-1).structures[0], changed = structuredClone(original);
  changed.nodes[0].meaning = 'different(scope)'; changed.nodes[0].type = 'different-type'; changed.edges[0].role = 'different-rule';
  assert.deepEqual(core.treeEmbedding(original).distances, core.treeEmbedding(changed).distances);
  assert.notDeepEqual(core.bindingExperiment(original).reconstruction, core.bindingExperiment(changed).reconstruction);
});

test('role-overlap intervention changes distortion; complete overlap produces ties rather than arbitrary success', () => {
  const structure = fixture('ccg-english').frames.at(-1).structures[0];
  const rows = core.sweep(structure);
  for (let i=1;i<rows.length;i++) assert.ok(rows[i].maxError > rows[i-1].maxError);
  assert.equal(rows[1].reconstructedRecords, true); assert.equal(rows[1].exactVectors, false);
  assert.equal(rows.at(-1).correct, 0); assert.equal(rows.at(-1).ties, structure.nodes.length);
  assert.equal(rows.at(-1).reconstructedRecords, false);
});

test('unsupported observations can have no frames without being rendered as successful parses', () => {
  const bundle = fixture('ccg-english'); bundle.frames = []; bundle.tokens = [];
  bundle.status = 'unsupported_length'; bundle.supported = bundle.complete = false;
  assert.equal(core.validate(bundle).supported, false);
});

test('reject future-word leakage, invalid spans, schema drift, missing roles, duplicate nodes and cyclic topology', () => {
  const corruptions = [
    b => {b.schema = 'unknown';},
    b => {b.frames[0].observed.push('future');},
    b => {b.frames[0].structures[0].nodes[0].span = [0,3];},
    b => {b.frames.at(-1).structures[0].edges[0].role = null;},
    b => {b.frames[0].structures[0].nodes.push(b.frames[0].structures[0].nodes[0]);},
    b => {const s=b.frames.at(-1).structures[0]; s.edges[0].target=s.root;},
    b => {b.frames[0].omitted_structures = 2;},
  ];
  for (const mutate of corruptions) {const b = fixture('ccg-english'); mutate(b); assert.throws(() => core.validate(b));}
});

test('numeric intervention parameters and oversized imports are bounded', () => {
  const structure = fixture('ccg-english').frames.at(-1).structures[0];
  for (const value of [-1, 2, NaN, Infinity]) assert.throws(() => core.bindingExperiment(structure, value));
  assert.throws(() => core.parse(' '.repeat(core.MAX_BYTES + 1)), /8 MiB/);
});
