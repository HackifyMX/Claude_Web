/* =========================================================
   AI LAB ENTERPRISE — The AI Powered Enterprise
   Interaction layer (no dependencies)
   ========================================================= */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const isMobile = () => window.innerWidth < 760;
  const vh = () => window.innerHeight;

  /* Exposed state for verification */
  const state = {
    heroProgress: 0, heroFrame: 0, framesLoaded: 0, frameCount: 0, heroStage: 'IDLE',
    agentsOn: 0, linksOn: 0, orchOn: false, heroFinal: false, hudCounted: false,
    execAgentsOn: 0, execPhase: 0, execStep: 0,
    kgNodesOn: 0, kgQueries: 0, intConnected: 0,
    coordRunning: false, coordHops: 0, coordVerb: '',
    howIndex: 0, howX: 0,
    finalPlaying: false, coordPlaying: false, modalOpen: false, submitted: false, ready: false,
  };
  window.__aile = state;

  /* ---------------------------------------------------------
     Scroll engine: pinned scenes (progress 0..1 over the pin)
     + a light rAF "live" loop for time-driven system motion
     --------------------------------------------------------- */
  const scenes = [];
  function scene(el, fn) { if (!el) return null; const s = { el, fn, top: 0, range: 1, last: -1 }; scenes.push(s); return s; }
  function measure() {
    const y = window.scrollY;
    scenes.forEach((s) => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.range = Math.max(1, s.el.offsetHeight - vh()); s.last = -1; });
  }
  const vscenes = [];
  function vscene(el, fn) { if (!el) return; vscenes.push({ el, fn, last: -1 }); }

  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    const y = window.scrollY;
    for (const s of scenes) { const p = clamp((y - s.top) / s.range, 0, 1); if (p !== s.last) { s.last = p; s.fn(p); } }
    for (const v of vscenes) {
      const r = v.el.getBoundingClientRect();
      const p = clamp((vh() * 0.92 - r.top) / (vh() * 0.7), 0, 1);
      if (p !== v.last) { v.last = p; v.fn(p); }
    }
    navUpdate(y);
  }

  const live = new Set();
  let liveRunning = false;
  function liveTick(now) {
    if (!live.size) { liveRunning = false; return; }
    live.forEach((fn) => fn(now));
    requestAnimationFrame(liveTick);
  }
  function liveAdd(fn) { live.add(fn); if (!liveRunning) { liveRunning = true; requestAnimationFrame(liveTick); } }
  function liveRemove(fn) { live.delete(fn); }

  /* ---------------------------------------------------------
     NAV
     --------------------------------------------------------- */
  const nav = $('#nav');
  const lightSections = $$('.light');
  const NAV_H = 68;
  function navUpdate(y) {
    nav.classList.toggle('is-scrolled', y > 10);
    let light = false;
    for (const s of lightSections) { const r = s.getBoundingClientRect(); if (r.top <= NAV_H && r.bottom > NAV_H) { light = true; break; } }
    nav.classList.toggle('is-light', light);
  }

  /* ---------------------------------------------------------
     REVEAL
     --------------------------------------------------------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
  }, { threshold: 0.15 });
  $$('.reveal').forEach((el) => revealIO.observe(el));

  /* ---------------------------------------------------------
     1. HERO — scroll-scrubbed frame sequence + agent network
     --------------------------------------------------------- */
  const hero = $('#hero');
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const heroCopy = $('#heroCopy');
  const heroBar = $('#heroBar');
  const heroStageIdx = $('#heroStageIdx');
  const heroStageTxt = $('#heroStageTxt');
  const heroLog = $('#heroLog');
  const heroFinal = $('#heroFinal');
  const heroHud = $('#heroHud');
  const net = $('#heroNet');
  const agents = $$('.agent', net);
  const links = $$('#netLinks path');
  const spokes = $$('#netSpokes path');
  const packets = $$('#netPackets circle');
  const orch = $('#netOrch');
  const orchState = $('.orch__state', orch);

  const FRAME_COUNT = Number(hero.dataset.frames || 96);
  const FRAME_STEP = isMobile() ? 2 : 1; // mobile loads every 2nd frame
  const FRAME_PATH = (i) => `assets/hero/frames/frame_${String(i).padStart(4, '0')}.webp`;
  const frames = new Array(FRAME_COUNT).fill(null);
  let lastDrawn = -1, currentFrame = 0, targetFrame = 0, drawLoop = false;
  state.frameCount = FRAME_COUNT;

  function sizeCanvas() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastDrawn = -1;
    drawFrame(Math.round(currentFrame), true);
  }
  function nearestLoaded(i) {
    if (frames[i]) return i;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && frames[i - d]) return i - d;
      if (i + d < FRAME_COUNT && frames[i + d]) return i + d;
    }
    return -1;
  }
  function drawFrame(i, force) {
    const idx = nearestLoaded(i);
    if (idx < 0 || (!force && idx === lastDrawn)) return;
    const img = frames[idx];
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.fillStyle = '#0B0B0D';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    lastDrawn = idx;
    state.heroFrame = idx;
    if (!state.ready) { state.ready = true; hero.classList.add('is-ready'); }
  }
  function loadFrame(i) {
    return new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; state.framesLoaded++; if (Math.abs(i - targetFrame) < 2 || lastDrawn < 0) drawFrame(Math.round(currentFrame), true); res(); };
      img.onerror = () => res();
      img.src = FRAME_PATH(i + 1);
    });
  }
  function loadFrames() {
    // Coarse-to-fine order so scrubbing is usable early; nearestLoaded() fills gaps.
    const order = [];
    const seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) {
      for (let i = 0; i < FRAME_COUNT; i += Math.max(step, FRAME_STEP)) { if (!seen.has(i)) { seen.add(i); order.push(i); } }
    }
    if (FRAME_STEP > 1) order.push(FRAME_COUNT - 1);
    let cursor = 0;
    const CONC = 6;
    const next = () => { if (cursor >= order.length) return; const i = order[cursor++]; loadFrame(i).then(next); };
    loadFrame(0).then(() => { for (let k = 0; k < CONC; k++) next(); });
  }
  function drawTick() {
    currentFrame = lerp(currentFrame, targetFrame, prefersReduced ? 1 : 0.28);
    if (Math.abs(currentFrame - targetFrame) < 0.05) { currentFrame = targetFrame; drawLoop = false; }
    drawFrame(Math.round(currentFrame));
    if (drawLoop) requestAnimationFrame(drawTick);
  }
  function setTargetFrame(p) {
    targetFrame = Math.round(p * (FRAME_COUNT - 1));
    if (!drawLoop) { drawLoop = true; requestAnimationFrame(drawTick); }
  }

  // Network choreography thresholds
  const AG = [0.10, 0.19, 0.28, 0.37, 0.45, 0.53];               // FINANCE, SUPPORT, MARKET INTEL, CONTENT, SALES, OPERATIONS
  const LK = [0.31, 0.55, 0.60, 0.65];                           // lnk0 Market→Finance (early), then the rest
  const ORCH_AT = 0.68, WF_AT = 0.78, FINAL_AT = 0.90;
  const STAGES = [[0, '00', 'SYSTEM IDLE'], [0.10, '01', 'AGENT ACTIVATION'], [0.53, '02', 'AGENTS COMMUNICATING'], [0.68, '03', 'ORCHESTRATION LAYER ONLINE'], [0.78, '04', 'WORKFLOWS EXECUTING'], [0.90, '05', 'AI POWERED ENTERPRISE']];
  const LOG = [
    [0.10, 'FINANCE AGENT', 'ONLINE'], [0.19, 'SUPPORT AGENT', 'ONLINE'], [0.28, 'MARKET INTELLIGENCE AGENT', 'ONLINE'],
    [0.33, 'MARKET INTEL → FINANCE', 'DATA SENT'], [0.37, 'CONTENT AGENT', 'ONLINE'], [0.41, 'CONTENT AGENT', 'EXECUTING · EXEC REPORT'],
    [0.45, 'SALES AGENT', 'ONLINE'], [0.53, 'OPERATIONS AGENT', 'ONLINE'], [0.60, 'AGENT LINKS', 'HANDOFF COMPLETE'],
    [0.70, 'ORCHESTRATION LAYER', 'ONLINE'], [0.79, 'WORKFLOWS', '14 ACTIVE'], [0.85, 'HUMAN CHECKPOINT', 'APPROVED', true], [0.90, 'SYSTEM', 'EXECUTION COMPLETE'],
  ];
  const logEls = LOG.map(([, k, v, human]) => { const li = document.createElement('li'); li.innerHTML = `${k}<b>${v}</b>`; if (human) li.classList.add('is-human'); heroLog.appendChild(li); return li; });
  const linkLen = links.map((l) => l.getTotalLength());
  links.forEach((l, i) => { l.style.strokeDasharray = linkLen[i]; l.style.strokeDashoffset = linkLen[i]; });
  const packetPath = packets.map((c) => $('#' + c.dataset.path));

  // Mobile stack: SPECIALIZED AGENTS ↓ ORCHESTRATION ↓ EXECUTION ↓ AI POWERED ENTERPRISE
  const stack = document.createElement('ul');
  stack.className = 'hero__stack';
  stack.setAttribute('aria-hidden', 'true');
  const STACK = [['SPECIALIZED AGENTS', 0.10, 'sep'], ['FINANCE AGENT', AG[0]], ['SUPPORT AGENT', AG[1]], ['MARKET INTELLIGENCE AGENT', AG[2]], ['CONTENT AGENT', AG[3]], ['SALES AGENT', AG[4]], ['OPERATIONS AGENT', AG[5]], ['↓ ORCHESTRATION', ORCH_AT, 'sep'], ['↓ EXECUTION', WF_AT, 'sep'], ['↓ AI POWERED ENTERPRISE', FINAL_AT, 'sep']];
  const stackEls = STACK.map(([t, , kind]) => { const li = document.createElement('li'); if (kind === 'sep') li.className = 'stack__sep'; else li.innerHTML = '<i></i>'; li.appendChild(document.createTextNode(t)); stack.appendChild(li); return li; });
  $('.hero__sticky').appendChild(stack);

  let heroLiveP = 0;
  function heroLive(now) {
    // Time-driven packet drift once workflows are executing (keeps the end state alive without scroll)
    const t0 = now / 1000;
    packets.forEach((c, k) => {
      const path = packetPath[k]; const L = linkLen[k];
      const t = ((t0 * 0.22) + k * 0.25) % 1;
      const pt = path.getPointAtLength(t * L);
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
      c.style.opacity = heroLiveP >= WF_AT ? (heroLiveP >= FINAL_AT ? 0.55 : 1) : 0;
    });
  }

  function heroUpdate(p) {
    state.heroProgress = p;
    heroBar.style.width = (p * 100).toFixed(2) + '%';
    setTargetFrame(p);

    // Copy fades as the workforce starts activating
    const copyT = 1 - smooth(0.02, 0.12, p);
    heroCopy.style.opacity = copyT;
    heroCopy.style.transform = `translateY(${(1 - copyT) * 40}px)`;
    heroCopy.style.pointerEvents = copyT > 0.2 ? 'auto' : 'none';

    // Stage label
    let st = STAGES[0];
    for (const s of STAGES) if (p >= s[0]) st = s;
    if (state.heroStage !== st[2]) { state.heroStage = st[2]; heroStageIdx.textContent = st[1]; heroStageTxt.textContent = st[2]; }

    // Log (show the latest 6 entries)
    const shown = LOG.map((l) => p >= l[0]);
    const lastIdx = shown.lastIndexOf(true);
    logEls.forEach((li, i) => li.classList.toggle('is-in', shown[i] && i > lastIdx - 6));

    // Agents
    let on = 0;
    agents.forEach((a, i) => {
      const t = smooth(AG[i], AG[i] + 0.04, p);
      a.style.opacity = t;
      const isOn = p >= AG[i];
      a.classList.toggle('is-on', isOn);
      if (isOn) on++;
      const stateEl = $('.agent__state', a);
      const busy = (i === 3 && p >= 0.41 && p < 0.50) || (p >= WF_AT && p < FINAL_AT) || (p >= FINAL_AT);
      a.classList.toggle('is-busy', busy && isOn);
      const txt = !isOn ? 'STANDBY' : (p >= FINAL_AT ? 'NOMINAL' : (p >= WF_AT ? 'EXECUTING' : (i === 3 && p >= 0.41 && p < 0.50 ? 'EXECUTING' : 'ONLINE')));
      if (stateEl.textContent !== txt) stateEl.textContent = txt;
    });
    state.agentsOn = on;
    stackEls.forEach((li, i) => li.classList.toggle('is-on', p >= STACK[i][1]));

    // Agent-to-agent links draw on
    let linksOn = 0;
    links.forEach((l, k) => { const t = smooth(LK[k], LK[k] + 0.07, p); l.style.strokeDashoffset = linkLen[k] * (1 - t); if (t >= 1) linksOn++; });
    state.linksOn = linksOn;

    // Early single handoff on lnk0 (Market Intel → Finance) before workflows begin
    if (p >= 0.33 && p < WF_AT) {
      const t = smooth(0.33, 0.40, p);
      const pt = packetPath[0].getPointAtLength(t * linkLen[0]);
      packets[0].setAttribute('cx', pt.x); packets[0].setAttribute('cy', pt.y);
      packets[0].style.opacity = t > 0 && t < 1 ? 1 : 0;
    } else if (p < 0.33) { packets[0].style.opacity = 0; }

    // Orchestrator
    const orchT = smooth(ORCH_AT, ORCH_AT + 0.06, p);
    orch.style.opacity = orchT;
    const orchOn = p >= ORCH_AT;
    orch.classList.toggle('is-on', orchOn);
    state.orchOn = orchOn;
    const os = !orchOn ? 'STANDBY' : (p >= WF_AT ? 'COORDINATING' : 'ONLINE');
    if (orchState.textContent !== os) orchState.textContent = os;
    spokes.forEach((s, i) => { s.style.opacity = smooth(ORCH_AT + 0.02 + i * 0.015, ORCH_AT + 0.06 + i * 0.015, p) * 0.9; });

    // Workflows (time-driven packets while in range)
    heroLiveP = p;
    if (p >= WF_AT && !prefersReduced) liveAdd(heroLive); else { liveRemove(heroLive); if (p < 0.33 || (p >= 0.40 && p < WF_AT)) packets.forEach((c, k) => { if (k > 0 || p >= 0.40) c.style.opacity = 0; }); }

    // Final state
    const fin = p >= FINAL_AT;
    heroFinal.classList.toggle('is-in', fin);
    heroHud.classList.toggle('is-in', fin);
    state.heroFinal = fin;
    net.style.opacity = 1 - 0.45 * smooth(FINAL_AT, 1, p);
    if (fin && !state.hudCounted) { state.hudCounted = true; runCounters(heroHud); }
  }

  function runCounters(root) {
    $$('[data-counter]', root).forEach((el) => {
      const target = Number(el.dataset.counter), pad = Number(el.dataset.pad || 0);
      const start = performance.now(), dur = prefersReduced ? 0 : 1400;
      const step = (now) => {
        const t = dur ? clamp((now - start) / dur, 0, 1) : 1;
        const e = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * e)).padStart(pad, '0');
        if (t < 1) requestAnimationFrame(step); else el.dataset.done = '1';
      };
      requestAnimationFrame(step);
    });
  }

  scene(hero, heroUpdate);
  if (prefersReduced) { heroUpdate(1); }

  /* ---------------------------------------------------------
     2. LAYER 01 — Knowledge graph
     --------------------------------------------------------- */
  const kgSvg = $('#kgSvg');
  const kgStat = $('#kgStat');
  const kgQuery = $('#kgQuery');
  const KG_NODES = [
    ['d1', 'doc', 'SOP · SALES', 100, 80], ['d4', 'doc', 'PLAYBOOK', 300, 58], ['d2', 'doc', 'CONTRACTS', 70, 250], ['d3', 'doc', 'Q2 REPORT', 130, 430],
    ['p1', 'dept', 'SALES', 250, 170], ['p2', 'dept', 'FINANCE', 400, 120], ['p3', 'dept', 'OPERATIONS', 560, 90], ['p4', 'dept', 'SUPPORT', 700, 180],
    ['c1', 'cust', 'ACCT 1042', 210, 330], ['c2', 'cust', 'ACCT 0871', 330, 420], ['c3', 'cust', 'ACCT 2210', 480, 470],
    ['t1', 'txn', 'INV-4471', 380, 290], ['t2', 'txn', 'PO-2210', 520, 330], ['t3', 'txn', 'INV-3902', 640, 420],
    ['r3', 'proc', 'ESCALATION', 560, 205], ['r1', 'proc', 'ONBOARDING', 690, 300], ['r2', 'proc', 'BILLING', 740, 410],
    ['a1', 'agent', 'FINANCE AGENT', 720, 60], ['a3', 'agent', 'SALES AGENT', 70, 500], ['a2', 'agent', 'SUPPORT AGENT', 740, 500],
  ];
  const KG_EDGES = [['d1', 'p1'], ['d4', 'p1'], ['p1', 'c1'], ['p1', 't1'], ['p2', 't1'], ['p2', 't2'], ['d2', 'c1'], ['c1', 't1'], ['c2', 't2'], ['c2', 'p1'], ['t2', 'p3'], ['p3', 'r1'], ['r1', 'p4'], ['p4', 'r3'], ['r3', 'p2'], ['t3', 'r2'], ['r2', 'p2'], ['c3', 't3'], ['c3', 'p4'], ['d3', 'p2'], ['p3', 'r2'], ['a1', 'p2'], ['a1', 't1'], ['a2', 'p4'], ['a2', 'r3'], ['a3', 'p1'], ['a3', 'c2'], ['t1', 'r2'], ['c1', 'c2'], ['d3', 't3'], ['d4', 'p2'], ['p3', 'p4']];
  const kgNode = {}, kgEdgeEls = [];
  if (kgSvg) {
    const gE = svgEl('g', {}, kgSvg), gN = svgEl('g', {}, kgSvg);
    KG_NODES.forEach(([id, type, label, x, y]) => {
      const g = svgEl('g', { class: `kg__node kg__node--${type}`, transform: `translate(${x} ${y})` }, gN);
      if (type === 'doc') svgEl('rect', { x: -13, y: -9, width: 26, height: 18, rx: 2 }, g);
      else if (type === 'dept') svgEl('circle', { r: 11 }, g);
      else if (type === 'cust') svgEl('circle', { r: 6.5 }, g);
      else if (type === 'txn') svgEl('rect', { x: -7, y: -7, width: 14, height: 14 }, g);
      else if (type === 'proc') svgEl('path', { d: 'M-10 0 L-5 -9 L5 -9 L10 0 L5 9 L-5 9z' }, g);
      else svgEl('path', { d: 'M0 -12 L12 0 0 12 -12 0z' }, g);
      const tx = svgEl('text', { y: type === 'dept' ? 26 : 22, 'text-anchor': 'middle' }, g); tx.textContent = label;
      kgNode[id] = { g, x, y, edges: [] };
    });
    KG_EDGES.forEach(([a, b]) => {
      const A = kgNode[a], B = kgNode[b];
      const l = svgEl('line', { class: 'kg__edge', x1: A.x, y1: A.y, x2: B.x, y2: B.y }, gE);
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      l.style.strokeDasharray = len; l.style.strokeDashoffset = len;
      const e = { el: l, a, b }; kgEdgeEls.push(e); A.edges.push(e); B.edges.push(e);
    });
    const pulse = svgEl('circle', { class: 'kg__pulse', r: 4 }, kgSvg);

    const N = KG_NODES.length;
    vscene(kgSvg, (p) => {
      let on = 0;
      const onSet = new Set();
      KG_NODES.forEach(([id], i) => { const isOn = p * 1.1 >= (i + 1) / N; kgNode[id].g.classList.toggle('is-on', isOn); if (isOn) { on++; onSet.add(id); } });
      let eOn = 0;
      kgEdgeEls.forEach((e) => { const isOn = onSet.has(e.a) && onSet.has(e.b); e.el.classList.toggle('is-on', isOn); if (isOn) eOn++; });
      state.kgNodesOn = on;
      kgStat.textContent = `NODES ${String(on).padStart(3, '0')} · EDGES ${String(eOn).padStart(3, '0')}`;
    });

    // Agent query loop (only while visible and fully built)
    let kgTimer = null, kgHot = [];
    const AGENTS_Q = [['a1', 'FINANCE AGENT'], ['a2', 'SUPPORT AGENT'], ['a3', 'SALES AGENT']];
    function kgRun() {
      kgHot.forEach((el) => el.classList.remove('is-hot')); kgHot = [];
      if (state.kgNodesOn < N) return;
      const [aid, aname] = AGENTS_Q[state.kgQueries % AGENTS_Q.length];
      let cur = aid; const path = [aid]; const visited = new Set([aid]);
      for (let k = 0; k < 3; k++) {
        const cands = kgNode[cur].edges.map((e) => (e.a === cur ? e.b : e.a)).filter((n) => !visited.has(n));
        if (!cands.length) break;
        const nxt = cands[(state.kgQueries * 7 + k * 3) % cands.length];
        const edge = kgNode[cur].edges.find((e) => (e.a === cur && e.b === nxt) || (e.b === cur && e.a === nxt));
        edge.el.classList.add('is-hot'); kgHot.push(edge.el);
        visited.add(nxt); path.push(nxt); cur = nxt;
      }
      path.forEach((id) => { kgNode[id].g.classList.add('is-hot'); kgHot.push(kgNode[id].g); });
      const labels = path.map((id) => KG_NODES.find((n) => n[0] === id)[2].replace(' AGENT', ''));
      kgQuery.innerHTML = `AGENT QUERY · <em>${aname}</em> → ${labels.slice(1).join(' → ')} · <em>${path.length - 1} CORRELATIONS FOUND</em>`;
      // pulse along the path
      const start = performance.now();
      const pts = path.map((id) => kgNode[id]);
      const anim = (now) => {
        const t = clamp((now - start) / 1400, 0, 1); const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))); const lt = t * (pts.length - 1) - seg;
        const A = pts[seg], B = pts[seg + 1] || A;
        pulse.setAttribute('cx', lerp(A.x, B.x, lt)); pulse.setAttribute('cy', lerp(A.y, B.y, lt)); pulse.style.opacity = t < 1 ? 1 : 0;
        if (t < 1) requestAnimationFrame(anim);
      };
      if (!prefersReduced) requestAnimationFrame(anim);
      state.kgQueries++;
    }
    new IntersectionObserver((en) => {
      en.forEach((e) => { if (e.isIntersecting) { if (!kgTimer) { kgRun(); kgTimer = setInterval(kgRun, 2200); } } else if (kgTimer) { clearInterval(kgTimer); kgTimer = null; } });
    }, { threshold: 0.3 }).observe(kgSvg);
  }

  /* ---------------------------------------------------------
     3. LAYER 02 — Integration map
     --------------------------------------------------------- */
  const intSvg = $('#intSvg');
  if (intSvg) {
    const SYSTEMS = [['CRM', 'SALES'], ['ERP', 'OPERATIONS'], ['BANKING', 'FINANCE'], ['SPREADSHEETS', 'FINANCE'], ['ACCOUNTING', 'FINANCE'], ['HELPDESK', 'SUPPORT'], ['HR', 'PEOPLE'], ['EMAIL', 'COMMS']];
    const hubX = 400, hubY = 260, hubW = 220, hubH = 96;
    const gW = svgEl('g', {}, intSvg), gS = svgEl('g', {}, intSvg), gP = svgEl('g', {}, intSvg);
    const hub = svgEl('g', { class: 'int__hub', transform: `translate(${hubX} ${hubY})` }, intSvg);
    svgEl('rect', { x: -hubW / 2, y: -hubH / 2, width: hubW, height: hubH, rx: 4 }, hub);
    svgEl('path', { d: 'M0 -14 L10 -4 0 6 -10 -4z', fill: 'var(--accent)' }, hub);
    const ht = svgEl('text', { y: 24, 'text-anchor': 'middle' }, hub); ht.textContent = 'ORCHESTRATION LAYER';
    const hs = svgEl('text', { class: 'mono', y: 38, 'text-anchor': 'middle' }, hub); hs.textContent = 'SINGLE SYSTEM';
    const sysEls = [], wireEls = [], pktEls = [];
    SYSTEMS.forEach(([name, cat], i) => {
      const left = i < 4; const row = i % 4;
      const x = left ? 110 : 690, y = 80 + row * 120;
      const g = svgEl('g', { class: 'int__sys', transform: `translate(${x} ${y})` }, gS);
      svgEl('rect', { x: -70, y: -24, width: 140, height: 48, rx: 3 }, g);
      const t = svgEl('text', { y: -2, 'text-anchor': 'middle' }, g); t.textContent = name;
      const c = svgEl('text', { class: 'int__cat', y: 14, 'text-anchor': 'middle' }, g); c.textContent = cat;
      sysEls.push(g);
      const sx = left ? x + 70 : x - 70, ex = left ? hubX - hubW / 2 : hubX + hubW / 2;
      const d = `M${sx} ${y} C ${lerp(sx, ex, 0.5)} ${y}, ${lerp(sx, ex, 0.5)} ${hubY}, ${ex} ${hubY + (row - 1.5) * 16}`;
      const w = svgEl('path', { class: 'int__wire', d }, gW);
      const len = w.getTotalLength(); w.style.strokeDasharray = len; w.style.strokeDashoffset = len;
      wireEls.push(w);
      const pk = svgEl('circle', { class: 'int__pkt', r: 3.5 }, gP);
      pk.style.offsetPath = `path("${d}")`; pk.style.animationDelay = `${(i * 0.35).toFixed(2)}s`;
      pktEls.push(pk);
    });
    const intStat = $('#intStat'), intFoot = $('#intFoot');
    vscene(intSvg, (p) => {
      let on = 0;
      SYSTEMS.forEach((s, i) => { const isOn = p * 1.05 >= (i + 1) / SYSTEMS.length; sysEls[i].classList.toggle('is-on', isOn); wireEls[i].classList.toggle('is-on', isOn); pktEls[i].classList.toggle('is-on', isOn && !prefersReduced); if (isOn) on++; });
      state.intConnected = on;
      intStat.textContent = `CONNECTED ${on} / ${SYSTEMS.length}`;
      intFoot.innerHTML = on === SYSTEMS.length ? 'HANDOFFS · <em>automatic</em> · DUPLICATED WORK · <em>0</em>' : (on ? `HANDOFFS · <em>connecting</em>` : 'HANDOFFS · <em>manual</em>');
    });
  }

  /* ---------------------------------------------------------
     4. LAYER 03 — Execution (pinned): activate → communicate → execute
     --------------------------------------------------------- */
  const exec = $('#layer-03');
  const cards = $$('.acard');
  const busLine = $('#busLine');
  const stubs = $$('#execBus .bus__stubs path');
  const busPackets = $$('#busPackets rect');
  const execPhase = $('#execPhase');
  const SEQ = [4, 0, 5, 1, 3, 2]; // SALES → FINANCE → OPERATIONS → SUPPORT → MARKET INTEL → CONTENT
  const busLen = busLine ? busLine.getTotalLength() : 0;
  if (busLine) { busLine.style.strokeDasharray = busLen; busLine.style.strokeDashoffset = busLen; }
  const STUB_X = [200, 600, 1000, 200, 600, 1000];
  function execLive(now) {
    const t0 = now / 1000;
    busPackets.forEach((r, k) => { const t = ((t0 * 0.16) + k / busPackets.length) % 1; r.setAttribute('x', 40 + t * 1120 - 7); r.style.opacity = state.execPhase >= 3 ? 1 : 0; });
  }
  function execUpdate(p) {
    // Phase 1 — sequential activation
    let on = 0;
    cards.forEach((c, i) => { const isOn = p >= 0.06 + i * 0.075; c.classList.toggle('is-on', isOn); if (isOn) on++; const st = $('.acard__state', c); if (!isOn) { st.textContent = 'STANDBY'; c.classList.remove('is-busy', 'is-done'); $('.acard__task', c).textContent = '—'; } else if (st.textContent === 'STANDBY') st.textContent = 'ONLINE'; });
    state.execAgentsOn = on;
    // Phase 2 — communication bus draws on
    const busT = smooth(0.52, 0.66, p);
    if (busLine) busLine.style.strokeDashoffset = busLen * (1 - busT);
    stubs.forEach((s, i) => s.classList.toggle('is-on', p >= 0.58 + i * 0.015));
    // Phase 3 — shared workflow executes
    let step = 0;
    if (p >= 0.70) step = Math.min(SEQ.length, Math.floor((p - 0.70) / 0.042) + 1);
    SEQ.forEach((ci, k) => {
      const c = cards[ci]; const st = $('.acard__state', c); const task = $('.acard__task', c);
      const active = step === k + 1, done = step > k + 1;
      c.classList.toggle('is-busy', active); c.classList.toggle('is-done', done);
      stubs[ci].classList.toggle('is-hot', active);
      if (active) { st.textContent = 'EXECUTING'; task.textContent = task.dataset.task; }
      else if (done) { st.textContent = 'HANDOFF COMPLETE'; task.textContent = task.dataset.task; }
      else if (c.classList.contains('is-on')) { st.textContent = 'ONLINE'; task.textContent = '—'; }
    });
    const complete = step >= SEQ.length && p >= 0.70 + SEQ.length * 0.042 + 0.02;
    const phase = complete ? 4 : (step > 0 ? 3 : (busT > 0 ? 2 : (on > 0 ? 1 : 0)));
    state.execPhase = phase; state.execStep = step;
    const txt = phase === 0 ? 'AWAITING ACTIVATION' : phase === 1 ? `ACTIVATING AGENTS · ${on}/6 ONLINE` : phase === 2 ? 'AGENTS COMMUNICATING · LINKS ESTABLISHED' : phase === 3 ? `EXECUTING SHARED WORKFLOW · HANDOFF ${step}/6` : 'EXECUTION COMPLETE · HUMAN CHECKPOINT CLEARED';
    execPhase.lastChild.textContent = txt;
    execPhase.classList.toggle('is-on', phase > 0);
    if (phase >= 3 && !prefersReduced && !isMobile()) liveAdd(execLive); else { liveRemove(execLive); busPackets.forEach((r) => (r.style.opacity = 0)); }
  }
  if (exec) {
    scene(exec, execUpdate);
    if (prefersReduced) execUpdate(1);
    // Mobile: no pin — activate cards as they enter the viewport
    const cardIO = new IntersectionObserver((en) => { if (!isMobile()) return; en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-on'); $('.acard__state', e.target).textContent = 'ONLINE'; $('.acard__task', e.target).textContent = $('.acard__task', e.target).dataset.task; } }); }, { threshold: 0.4 });
    cards.forEach((c) => cardIO.observe(c));
  }

  /* ---------------------------------------------------------
     5. LAYER 04 — Coordination: orchestrator + simultaneous workflows
     --------------------------------------------------------- */
  const orchSvg = $('#orchSvg');
  if (orchSvg) {
    const CX = 400, CY = 250, RX = 300, RY = 180;
    const NAMES = ['SALES', 'FINANCE', 'OPERATIONS', 'SUPPORT', 'MARKET INTEL', 'STRATEGY', 'CONTENT', 'EXEC REPORT', 'KNOWLEDGE BASE', 'RESOLUTION', 'HUMAN'];
    const FLOWS = [[0, 1, 2, 3], [4, 5, 6, 7], [3, 8, 9, 10]];
    const VERBS = ['RECEIVES', 'ANALYZES', 'DELEGATES', 'COORDINATES', 'VALIDATES', 'EXECUTES', 'ESCALATES'];
    const gL = svgEl('g', {}, orchSvg);
    svgEl('circle', { class: 'orch__ring orch__ring--a', cx: CX, cy: CY, r: 96 }, orchSvg);
    svgEl('circle', { class: 'orch__ring orch__ring--b', cx: CX, cy: CY, r: 66 }, orchSvg);
    svgEl('circle', { class: 'orch__ring', cx: CX, cy: CY, r: 40 }, orchSvg);
    svgEl('circle', { class: 'orch__center', cx: CX, cy: CY, r: 24 }, orchSvg);
    svgEl('path', { class: 'orch__centerCore', d: `M${CX} ${CY - 9} L${CX + 9} ${CY} ${CX} ${CY + 9} ${CX - 9} ${CY}z` }, orchSvg);
    const title = svgEl('text', { class: 'orch__title', x: CX, y: CY + 128, 'text-anchor': 'middle' }, orchSvg); title.textContent = 'ORCHESTRATOR';
    const gV = svgEl('g', { class: 'orch__verbs' }, orchSvg);
    const verbEls = VERBS.map((v, i) => { const a = -Math.PI / 2 + (i / VERBS.length) * Math.PI * 2; const t = svgEl('text', { x: CX + Math.cos(a) * 112, y: CY + Math.sin(a) * 112 + 3, 'text-anchor': 'middle' }, gV); t.textContent = v; return t; });
    const nodes = NAMES.map((n, i) => {
      const a = -Math.PI / 2 + (i / NAMES.length) * Math.PI * 2;
      const x = CX + Math.cos(a) * RX, y = CY + Math.sin(a) * RY;
      const link = svgEl('line', { class: 'orch__link', x1: x, y1: y, x2: CX, y2: CY }, gL);
      const g = svgEl('g', { class: 'orch__node' + (n === 'HUMAN' ? ' orch__node--human' : ''), transform: `translate(${x} ${y})` }, orchSvg);
      svgEl('path', { d: 'M0 -12 L12 0 0 12 -12 0z' }, g);
      const c = Math.cos(a), s = Math.sin(a);
      const t = svgEl('text', { x: c > 0.35 ? 18 : c < -0.35 ? -18 : 0, y: Math.abs(c) > 0.35 ? 4 : (s < 0 ? -18 : 26), 'text-anchor': c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle' }, g);
      t.textContent = n;
      return { g, link, x, y };
    });
    const flowPkts = FLOWS.map(() => svgEl('circle', { class: 'orch__pkt', r: 4.5 }, orchSvg));
    const flowLis = $$('#orchFlows li');
    const orchVerb = $('#orchVerb');
    const HOP = 700, HOLD = 900, GAP = 1300;
    const OFF = [0, 1500, 3000];
    let hopsSeen = new Set();
    function coordTick(now) {
      nodes.forEach((n) => { n.g.classList.remove('is-hot'); n.link.classList.remove('is-hot'); });
      let verb = '';
      FLOWS.forEach((f, fi) => {
        const cycle = (f.length - 1) * HOP * 2 + HOLD + GAP;
        const t = (now + OFF[fi]) % cycle;
        const pkt = flowPkts[fi], li = flowLis[fi];
        const hopsTotal = (f.length - 1) * HOP * 2;
        if (t < hopsTotal) {
          const hop = Math.floor(t / (HOP * 2)); const lt = (t % (HOP * 2)) / (HOP * 2);
          const A = nodes[f[hop]], B = nodes[f[hop + 1]];
          const e = lt < 0.5 ? lt * 2 : (lt - 0.5) * 2; const ee = e * e * (3 - 2 * e);
          const x = lt < 0.5 ? lerp(A.x, CX, ee) : lerp(CX, B.x, ee), y = lt < 0.5 ? lerp(A.y, CY, ee) : lerp(CY, B.y, ee);
          pkt.setAttribute('cx', x); pkt.setAttribute('cy', y); pkt.style.opacity = 1;
          (lt < 0.5 ? A : B).g.classList.add('is-hot'); (lt < 0.5 ? A : B).link.classList.add('is-hot');
          if (lt >= 0.5) A.g.classList.add('is-hot');
          const isHuman = NAMES[f[hop + 1]] === 'HUMAN';
          verb = lt < 0.25 ? 'RECEIVES' : lt < 0.5 ? 'ANALYZES' : lt < 0.7 ? (isHuman ? 'ESCALATES' : 'DELEGATES') : lt < 0.9 ? 'COORDINATES' : (hop === f.length - 2 ? 'VALIDATES' : 'EXECUTES');
          li.classList.add('is-on');
          const key = fi + ':' + hop; if (!hopsSeen.has(key)) { hopsSeen.add(key); state.coordHops++; }
          const st = $('.flows__st', li); const s = isHuman && lt >= 0.5 ? 'HUMAN CHECKPOINT' : `STEP ${hop + 1}/${f.length - 1} · ${lt < 0.5 ? 'HANDOFF' : 'EXECUTING'}`; if (st.textContent !== s) st.textContent = s;
        } else if (t < hopsTotal + HOLD) {
          pkt.style.opacity = 0; li.classList.add('is-on'); const st = $('.flows__st', li); if (st.textContent !== 'EXECUTION COMPLETE') st.textContent = 'EXECUTION COMPLETE';
          nodes[f[f.length - 1]].g.classList.add('is-hot');
        } else { pkt.style.opacity = 0; li.classList.remove('is-on'); const st = $('.flows__st', li); if (st.textContent !== 'QUEUED') st.textContent = 'QUEUED'; hopsSeen = new Set([...hopsSeen].filter((k) => !k.startsWith(fi + ':'))); }
      });
      if (!verb) verb = 'RECEIVES';
      if (verb !== state.coordVerb) { state.coordVerb = verb; orchVerb.textContent = verb; verbEls.forEach((v, i) => v.classList.toggle('is-on', VERBS[i] === verb)); }
    }
    new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting && !prefersReduced) { state.coordRunning = true; liveAdd(coordTick); } else { state.coordRunning = false; liveRemove(coordTick); } }); }, { threshold: 0.25 }).observe(orchSvg);
    if (prefersReduced) { nodes.forEach((n) => n.link.classList.add('is-hot')); verbEls[0].classList.add('is-on'); }
  }

  /* ---------------------------------------------------------
     6. HOW IT WORKS — horizontal scroll-driven timeline
     --------------------------------------------------------- */
  const how = $('#how');
  const howTrack = $('#howTrack');
  const howSteps = $$('.step');
  const howProg = $$('#howProgress li');
  const howRail = $('#howRailFill');
  function howUpdate(p) {
    const viewport = howTrack.parentElement.clientWidth;
    const max = Math.max(0, howTrack.scrollWidth - viewport);
    const x = isMobile() ? 0 : -max * p;
    state.howX = x;
    howTrack.style.transform = `translate3d(${x}px,0,0)`;
    const idx = Math.min(4, Math.floor(p * 5.4));
    state.howIndex = idx;
    howSteps.forEach((s, i) => s.classList.toggle('is-on', i <= idx));
    howProg.forEach((s, i) => s.classList.toggle('is-on', i <= idx));
    howRail.style.width = (p * 100).toFixed(2) + '%';
  }
  if (how) { scene(how, howUpdate); if (prefersReduced) howUpdate(1); }

  /* ---------------------------------------------------------
     7. SUCCESS STORIES — Before → Built → Result reveal
     --------------------------------------------------------- */
  $$('.story').forEach((s) => {
    const toggle = () => s.classList.toggle('is-open');
    s.addEventListener('click', toggle);
    s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ---------------------------------------------------------
     8. BACKGROUND VIDEOS — load lazily, play only when visible
     --------------------------------------------------------- */
  function lazyVideo(video, onPlaying) {
    if (!video) return;
    let loaded = false;
    const io = new IntersectionObserver((en) => {
      en.forEach((e) => {
        if (e.isIntersecting) {
          if (!loaded) { loaded = true; video.preload = 'auto'; video.load(); }
          if (!prefersReduced) video.play().catch(() => {});
        } else { video.pause(); }
      });
    }, { rootMargin: '500px 0px' });
    video.addEventListener('playing', () => onPlaying(true));
    video.addEventListener('pause', () => onPlaying(false));
    io.observe(video);
  }
  const finalSection = $('#final');
  lazyVideo($('#finalVideo'), (on) => { state.finalPlaying = on; finalSection.classList.toggle('is-playing', on); });
  lazyVideo($('#coordVideo'), (on) => { state.coordPlaying = on; });

  // Final HUD log — calm, continuous
  const finalLog = $('#finalLog');
  const FLOG = [['SALES AGENT', 'LEAD QUALIFIED'], ['FINANCE AGENT', 'INVOICE VERIFIED'], ['SUPPORT AGENT', 'CASE RESOLVED'], ['OPERATIONS AGENT', 'SYNC COMPLETE'], ['MARKET INTEL', 'PRICE Δ LOGGED'], ['HUMAN CHECKPOINT', 'APPROVED', true], ['CONTENT AGENT', 'REPORT DELIVERED'], ['ORCHESTRATOR', 'SYSTEM NOMINAL']];
  let flogI = 0, flogT = null;
  function flogPush() {
    const [k, v, h] = FLOG[flogI++ % FLOG.length];
    const li = document.createElement('li'); li.innerHTML = `<span>${k}</span><b>${v}</b>`; if (h) li.classList.add('is-human');
    finalLog.appendChild(li); while (finalLog.children.length > 5) finalLog.removeChild(finalLog.firstChild);
  }
  new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting) { if (!flogT) { flogPush(); flogT = setInterval(flogPush, 1700); } } else if (flogT) { clearInterval(flogT); flogT = null; } }); }, { threshold: 0.2 }).observe(finalLog);

  /* ---------------------------------------------------------
     9. MODAL — diagnostic / specialist
     --------------------------------------------------------- */
  const modal = $('#modal');
  const form = $('#diagForm');
  const formOk = $('#formOk');
  const formErr = $('#formErr');
  const INTENTS = {
    diagnostic: { tag: 'AI DIAGNOSTIC', title: 'Get Your AI Diagnostic', body: 'One call. No commitment. We map where your operation stands and where intelligence creates the highest leverage.', cta: 'Request Diagnostic' },
    specialist: { tag: 'SPECIALIST', title: 'Talk to a Specialist', body: 'Tell us about your operation. A specialist from the AI Lab Enterprise team will walk you through what an AI Powered Enterprise looks like for your company.', cta: 'Request a Call' },
  };
  let lastFocus = null;
  function openModal(intent) {
    const cfg = INTENTS[intent] || INTENTS.diagnostic;
    $('#modalTag').textContent = cfg.tag; $('#modalTitle').textContent = cfg.title; $('#modalBody').textContent = cfg.body;
    $('.form__submit span', form).textContent = cfg.cta;
    $('#formIntent').value = intent;
    form.hidden = false; formOk.hidden = true; formErr.hidden = true;
    lastFocus = document.activeElement;
    modal.hidden = false; document.body.style.overflow = 'hidden'; state.modalOpen = true;
    setTimeout(() => $('input[name=name]', form).focus(), 50);
  }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ''; state.modalOpen = false; if (lastFocus) lastFocus.focus(); }
  $$('[data-open-modal]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.intent)));
  $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, input, textarea, [href]', modal).filter((el) => !el.hidden && el.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const req = ['name', 'email', 'company'];
    let ok = true;
    req.forEach((n) => { const el = form.elements[n]; const valid = n === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()) : el.value.trim().length > 1; el.classList.toggle('is-invalid', !valid); if (!valid) ok = false; });
    formErr.hidden = ok;
    if (!ok) return;
    const btn = $('.form__submit', form); btn.disabled = true; $('span', btn).textContent = 'Submitting…';
    // Simulated submission — connect your CRM / endpoint here.
    setTimeout(() => { form.hidden = true; formOk.hidden = false; btn.disabled = false; state.submitted = true; $('.form__ok .btn').focus(); }, 700);
  });

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  $('#year').textContent = new Date().getFullYear();
  sizeCanvas();
  loadFrames();
  measure();
  frame();
  window.addEventListener('scroll', onScroll, { passive: true });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sizeCanvas(); measure(); frame(); }, 120); }, { passive: true });
  window.addEventListener('load', () => { measure(); frame(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); frame(); });
})();
