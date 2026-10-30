/* Native trace viewer. All imported text is rendered as text, never HTML. */
(() => {
  'use strict';
  const core = window.LingEmbedBridge, $ = id => document.getElementById(id);
  const el = (tag, text) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n;};
  let bundle, frameIndex = 0, alternativeIndex = 0, timer = null, selected = 0, experiment;
  function stop() {clearInterval(timer); timer = null; $('play').textContent = 'Play replay';}
  function status(text, error = false) {$('import-status').textContent = text; $('import-status').classList.toggle('error', error);}
  function load(value) {
    const checked = core.validate(value); stop(); bundle = checked; frameIndex = 0; alternativeIndex = 0;
    $('trace').hidden = false; $('engine').textContent = bundle.source.engine;
    $('sentence').textContent = [bundle.observation.left_context, bundle.observation.text].filter(Boolean).join(' ');
    $('coverage').textContent = `Recorded outcome: ${bundle.status} · supported: ${bundle.supported ? 'yes' : 'no'} · complete: ${bundle.complete ? 'yes' : 'no'}. This status describes the supplied observation.`;
    $('frame').max = Math.max(0, bundle.frames.length - 1); $('tokens').replaceChildren();
    bundle.tokens.forEach((token, index) => {
      const button = el('button', token.text); button.classList.toggle('context', token.context);
      button.title = token.context ? 'Supplied left context' : 'Observed continuation';
      button.onclick = () => {stop(); frameIndex = index; renderFrame();}; $('tokens').append(button);
    });
    if (bundle.frames.some(f => f.stage === 'completion')) {
      const b = el('button', 'Completion'); b.onclick = () => {stop(); frameIndex = bundle.frames.length - 1; renderFrame();}; $('tokens').append(b);
    }
    $('projection').replaceChildren();
    for (const [key, title] of [['preserves', 'Preserves'], ['omits', 'Omits']]) {
      $('projection').append(el('p', title)); const list = el('ul'); bundle.projection[key].forEach(text => list.append(el('li', text))); $('projection').append(list);
    }
    $('projection').append(el('p', bundle.projection.selection), el('p', bundle.projection.verification));
    $('provenance').textContent = JSON.stringify(bundle.source, null, 2);
    status('Loaded in this browser. Select a word to inspect its recorded state.'); renderFrame();
  }
  function renderFrame() {
    const frame = bundle.frames[frameIndex]; $('frame').value = frameIndex;
    $('previous').disabled = !frame || frameIndex === 0; $('next').disabled = !frame || frameIndex >= bundle.frames.length - 1;
    $('play').disabled = !frame || bundle.frames.length < 2; $('frame').disabled = !frame;
    [...$('tokens').children].forEach((b,i) => {b.setAttribute('aria-pressed', String(i === frameIndex)); b.classList.toggle('future', i > frameIndex);});
    $('alternative').replaceChildren(); alternativeIndex = 0;
    $('native-state').textContent = frame ? JSON.stringify(frame.native_state, null, 2) : 'No prefix trace recorded.';
    $('prefix').textContent = frame ? `${frame.stage === 'completion' ? 'After post-input completion' : `After token ${frameIndex + 1}${frame.context ? ' (context)' : ''}`}: ${frame.observed.join(' ')}${frame.accepted === false ? ' · word not accepted' : ''}` : 'No recorded prefix. See the coverage outcome above.';
    if (frame) frame.structures.forEach((s,i) => {const o = el('option', s.id); o.value = i; $('alternative').append(o);});
    $('alternative-label').hidden = !frame || frame.structures.length < 2;
    $('alternatives-note').textContent = frame ? `${frame.structures.length} exported structure(s); ${frame.omitted_structures} omitted. ${bundle.projection.selection}` : '';
    renderStructure();
  }
  function current() {return bundle?.frames[frameIndex]?.structures[alternativeIndex];}
  function renderStructure() {
    const structure = current(); $('structure-panels').hidden = !structure; $('empty-state').hidden = Boolean(structure);
    if (!structure) {$('empty-state').textContent = 'No full-span structure is available at this state. The recorded native state remains inspectable below; no tree has been invented.'; return;}
    selected = 0; $('structure-kind').textContent = structure.kind;
    $('structure-note').textContent = structure.metadata?.topology || structure.metadata?.alignment || '';
    const geometry = core.treeEmbedding(structure);
    $('geometry-result').textContent = `${structure.nodes.length} nodes · ${geometry.dimensions} dimensions · maximum distance error ${geometry.maxError.toExponential(1)}.`;
    drawTree(structure, geometry); drawDistances(structure, geometry); renderBinding();
    const tbody = $('sweep').querySelector('tbody'); tbody.replaceChildren();
    core.sweep(structure).forEach(row => {
      const tr = el('tr'); [row.overlap, row.maxError.toFixed(3), `${row.correct}/${row.nodes}`, row.ties].forEach(v => tr.append(el('td', String(v)))); tbody.append(tr);
    });
  }
  function drawTree(structure, geometry) {
    const svg = $('native-tree'); svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const shape = (tag, attrs, parent = svg) => {const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v)); parent.append(n); return n;};
    const rows = new Map(); geometry.depth.forEach((depth,i) => {if (!rows.has(depth)) rows.set(depth,[]); rows.get(depth).push(i);});
    const width = Math.max(500, Math.max(...[...rows.values()].map(row => row.length)) * 160);
    const height = rows.size * 100 + 30, positions = new Map();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.style.minWidth = `${Math.min(width, 900)}px`;
    rows.forEach((row, depth) => row.forEach((i,j) => positions.set(structure.nodes[i].id, [(j + .5) * width / row.length, depth * 100 + 40])));
    structure.edges.forEach(edge => {
      const [x1,y1] = positions.get(edge.source), [x2,y2] = positions.get(edge.target);
      shape('line', {x1,y1:y1+17,x2,y2:y2-17}); const text = shape('text', {x:(x1+x2)/2+5, y:(y1+y2)/2, class:'edge-role'}); text.textContent = edge.order === null ? edge.role : `${edge.role} [${edge.order}]`;
    });
    const groups = [];
    const choose = index => {selected = index; groups.forEach((g,i) => g.classList.toggle('selected', i === selected)); $('node-detail').textContent = JSON.stringify(structure.nodes[selected], null, 2);};
    structure.nodes.forEach((node,index) => {
      const [x,y] = positions.get(node.id), group = shape('g', {class:'node', transform:`translate(${x},${y})`, tabindex:0, role:'button', 'aria-label':`Inspect ${node.label}`}); groups.push(group);
      shape('rect', {x:-70,y:-18,width:140,height:38,rx:8}, group);
      const text = shape('text', {x:0,y:4,'text-anchor':'middle'},group); text.textContent = node.label.length > 20 ? node.label.slice(0,19)+'…' : node.label;
      const title = shape('title',{},group); title.textContent = [node.id,node.type,node.meaning].filter(Boolean).join(' · ');
      group.onclick = () => choose(index); group.onkeydown = e => {if (['Enter',' '].includes(e.key)) {e.preventDefault(); choose(index);}};
    }); choose(0);
  }
  function drawDistances(structure, geometry) {
    const matrix = $('distance-matrix'); matrix.replaceChildren();
    // Large tables are a view limit only; full geometry and checks use every node.
    const limit = Math.min(24, structure.nodes.length), head = el('tr'); head.append(el('th','node'));
    for (let i=0;i<limit;i++) head.append(el('th',structure.nodes[i].id)); matrix.append(head);
    const maximum = Math.max(1, ...geometry.distances.flat());
    for (let i=0;i<limit;i++) {
      const row = el('tr'); row.append(el('th',structure.nodes[i].id));
      for (let j=0;j<limit;j++) {const cell = el('td',String(geometry.distances[i][j])); cell.style.background = `rgba(167,139,250,${.06 + .5 * geometry.distances[i][j] / maximum})`; row.append(cell);} matrix.append(row);
    }
    if (limit < structure.nodes.length) {$('geometry-result').textContent += ' Matrix preview shows the first 24 nodes; checks include all nodes.';}
  }
  function renderBinding() {
    const structure = current(); if (!structure) return;
    const overlap = Number($('overlap').value); $('overlap-value').value = String(overlap); experiment = core.bindingExperiment(structure, overlap);
    $('binding-result').textContent = `${experiment.correct}/${experiment.nodes} uniquely recovered records · ${experiment.ties} tied queries · maximum vector error ${experiment.maxError.toExponential(2)}. ${experiment.exactVectors ? 'Exact vector recovery.' : 'Vectors are distorted.'} ${experiment.reconstructedRecords ? 'Decoded node and edge records match.' : 'Full record reconstruction fails.'}`;
  }
  $('previous').onclick = () => {stop(); frameIndex--; renderFrame();}; $('next').onclick = () => {stop(); frameIndex++; renderFrame();};
  $('frame').oninput = () => {stop(); frameIndex = Number($('frame').value); renderFrame();};
  $('alternative').onchange = () => {alternativeIndex = Number($('alternative').value); renderStructure();}; $('overlap').oninput = renderBinding;
  $('play').onclick = () => {
    if (timer) {stop(); return;}
    if (frameIndex === bundle.frames.length - 1) {frameIndex = 0; renderFrame();}
    $('play').textContent = 'Pause replay'; timer = setInterval(() => {if (frameIndex < bundle.frames.length - 1) {frameIndex++; renderFrame();} else stop();}, 1000);
  };
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  $('import-file').onchange = async event => {
    try {const file = event.target.files[0]; if (!file) return; if (file.size > core.MAX_BYTES) throw new Error('Export exceeds 8 MiB.'); load(core.parse(await file.text()));}
    catch (error) {status(`Import rejected: ${error.message}`, true);} finally {event.target.value = '';}
  };
  let exampleRequest = 0;
  document.querySelectorAll('[data-example]').forEach(button => {button.onclick = async () => {
    const request = ++exampleRequest;
    try {const response = await fetch(`examples/${button.dataset.example}.json`); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = core.parse(await response.text()); if (request === exampleRequest) load(data);}
    catch (error) {if (request === exampleRequest) status(error.message, true);}
  };});
  $('download-diagnostic').onclick = () => {
    const structure = current(), result = {schema:'lingembed.encoding-check.v1', source:bundle.source,
      frame:frameIndex, structure:structure.id, kind:structure.kind, geometry:core.treeEmbedding(structure),
      binding:experiment, sweep:core.sweep(structure), projection:bundle.projection,
      interpretation:'Deterministic representation diagnostic with supplied codebook; no neural or human measurements.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)], {type:'application/json'}));
    const a = el('a'); a.href = url; a.download = 'lingembed-encoding-check.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // Two-way handshake binds a transfer to the exact opener, origin and random
  // channel. Sentence contents never enter URLs or persistent browser storage.
  const params = new URLSearchParams(location.hash.slice(1)), channel = params.get('bridge'), origin = params.get('origin');
  if (channel && origin && window.opener) {
    let expected;
    try {expected = new URL(origin); if (!['http:','https:'].includes(expected.protocol) || expected.origin !== origin) throw new Error('Invalid origin');}
    catch (_) {status('Invalid workbench connection. Import a JSON file instead.', true); return;}
    const opener = window.opener;
    const ready = () => opener.postMessage({type:'lingembed:ready',channel}, origin);
    let readyTimer, expiry;
    const cleanup = () => {clearInterval(readyTimer); clearTimeout(expiry); window.removeEventListener('message', receive);};
    const receive = event => {
      if (event.source !== opener || event.origin !== origin || event.data?.channel !== channel || event.data?.type !== 'lingembed:analysis') return;
      try {load(event.data.analysis); opener.postMessage({type:'lingembed:loaded',channel}, origin); history.replaceState(null,'',location.pathname + location.search); cleanup();}
      catch (error) {status(`Import rejected: ${error.message}`, true); opener.postMessage({type:'lingembed:error',channel,error:error.message}, origin); cleanup();}
    };
    window.addEventListener('message', receive); ready(); readyTimer = setInterval(ready, 500);
    expiry = setTimeout(() => {cleanup(); status('Connection timed out. Reopen from the workbench or import its JSON export.', true);}, 15000);
  }
})();
