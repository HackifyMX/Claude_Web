/* =========================================================
   AI LAB — Claude Developer Certification Program
   Capa de interacción (sin dependencias)
   ========================================================= */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(hover: none)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const isMobile = () => window.innerWidth < 900;
  const vh = () => window.innerHeight;

  /* Estado expuesto para verificación (scripts/verify.mjs) */
  const state = {
    ready: false, heroProgress: 0, heroFrame: 0, framesLoaded: 0, frameCount: 0, heroStage: 'SISTEMA EN ESPERA', heroTeam: false,
    agentsOn: 0, linksOn: 0, orchOn: false, orchRole: '', heroFinal: false, hudCounted: false, particles: 0,
    netActive: '', netHovers: 0, trIndex: 0, prIndex: 0, prX: 0, galleryIndex: 0,
    certIn: false, supportIn: false, supportLinks: 0, profileIn: false, countersDone: 0, faqOpen: -1,
    videosPlaying: [], modalOpen: false, submitted: false, navLight: false, navScrolled: false,
  };
  window.__ailcd = state;

  /* ---------------------------------------------------------
     Motor de scroll: escenas fijadas (progreso 0..1) + loop vivo
     --------------------------------------------------------- */
  const scenes = [];
  function scene(el, fn) { if (!el) return null; const s = { el, fn, top: 0, range: 1, last: -1 }; scenes.push(s); return s; }
  const vscenes = [];
  function vscene(el, fn) { if (!el) return; vscenes.push({ el, fn, last: -1 }); }
  function measure() { const y = window.scrollY; scenes.forEach((s) => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.range = Math.max(1, s.el.offsetHeight - vh()); s.last = -1; }); }

  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    const y = window.scrollY;
    for (const s of scenes) { const p = clamp((y - s.top) / s.range, 0, 1); if (p !== s.last) { s.last = p; s.fn(p); } }
    for (const v of vscenes) { const r = v.el.getBoundingClientRect(); const p = clamp((vh() - r.top) / (r.height + vh()), 0, 1); if (p !== v.last) { v.last = p; v.fn(p); } }
    navUpdate(y);
  }
  const live = new Set(); let liveRunning = false;
  function liveTick(now) { if (!live.size) { liveRunning = false; return; } live.forEach((fn) => fn(now)); requestAnimationFrame(liveTick); }
  function liveAdd(fn) { live.add(fn); if (!liveRunning) { liveRunning = true; requestAnimationFrame(liveTick); } }
  function liveRemove(fn) { live.delete(fn); }
  /* Ejecuta fn solo mientras el elemento está en pantalla */
  function liveWhileVisible(el, fn, margin = '0px') {
    if (!el || prefersReduced) return;
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? liveAdd(fn) : liveRemove(fn))), { rootMargin: margin }).observe(el);
  }

  /* ---------------------------------------------------------
     NAV
     --------------------------------------------------------- */
  const nav = $('#nav');
  const lightSections = $$('.light');
  const NAV_H = 72;
  function navUpdate(y) {
    const sc = y > 10; nav.classList.toggle('is-scrolled', sc); state.navScrolled = sc;
    let light = false;
    for (const s of lightSections) { const r = s.getBoundingClientRect(); if (r.top <= NAV_H && r.bottom > NAV_H) { light = true; break; } }
    nav.classList.toggle('is-light', light); state.navLight = light;
    document.body.classList.toggle('light-hover', light);
  }
  const burger = $('#navBurger');
  burger.addEventListener('click', () => { const open = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); });
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }));

  /* ---------------------------------------------------------
     REVEALS + tipografía disparada por scroll
     --------------------------------------------------------- */
  $$('.reveal-words').forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach((w, i) => { const s = document.createElement('span'); s.className = 'w'; const inner = document.createElement('i'); inner.textContent = w; inner.style.transitionDelay = `${i * 0.05}s`; s.appendChild(inner); h.appendChild(s); if (i < words.length - 1) h.appendChild(document.createTextNode(' ')); });
  });
  const revealIO = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .reveal-words').forEach((el) => revealIO.observe(el));

  /* ---------------------------------------------------------
     01 · HERO — secuencia de frames + partículas + red de agentes
     --------------------------------------------------------- */
  const hero = $('#hero');
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const heroCopy = $('#heroCopy'), heroBar = $('#heroBar'), heroStageIdx = $('#heroStageIdx'), heroStageTxt = $('#heroStageTxt'), heroLog = $('#heroLog'), heroFinal = $('#heroFinal'), heroHud = $('#heroHud');
  const net = $('#heroNet');
  const agents = $$('.agent', net), links = $$('#netLinks path'), spokes = $$('#netSpokes path'), packets = $$('#netPackets circle');
  const orch = $('#netOrch'), orchName = $('.orch__name', orch), orchState = $('.orch__state', orch);

  const INLINE_FRAMES = Array.isArray(window.__AILCD_FRAMES) ? window.__AILCD_FRAMES : null;
  const FRAME_COUNT = INLINE_FRAMES ? INLINE_FRAMES.length : Number(hero.dataset.frames || 96);
  const FRAME_STEP = isMobile() && !INLINE_FRAMES ? 2 : 1;
  const FRAME_PATH = (i) => INLINE_FRAMES ? INLINE_FRAMES[i - 1] : `assets/hero/frames/frame_${String(i).padStart(4, '0')}.webp`;
  const frames = new Array(FRAME_COUNT).fill(null);
  let lastDrawn = -1, currentFrame = 0, targetFrame = 0, drawLoop = false, framesMissing = false;
  state.frameCount = FRAME_COUNT;

  function paintFallback(cw, ch) {
    const g = ctx.createRadialGradient(cw * 0.5, ch * 0.55, 0, cw * 0.5, ch * 0.55, Math.max(cw, ch) * 0.7);
    g.addColorStop(0, '#141a30'); g.addColorStop(0.5, '#0b0e18'); g.addColorStop(1, '#08090C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }
  function sizeCanvas() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); lastDrawn = -1;
    if (framesMissing) paintFallback(canvas.clientWidth, canvas.clientHeight); else drawFrame(Math.round(currentFrame), true);
  }
  function nearestLoaded(i) { if (frames[i]) return i; for (let d = 1; d < FRAME_COUNT; d++) { if (i - d >= 0 && frames[i - d]) return i - d; if (i + d < FRAME_COUNT && frames[i + d]) return i + d; } return -1; }
  function drawFrame(i, force) {
    const idx = nearestLoaded(i);
    if (idx < 0 || (!force && idx === lastDrawn)) return;
    const img = frames[idx], cw = canvas.clientWidth, ch = canvas.clientHeight;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.fillStyle = '#08090C'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    lastDrawn = idx; state.heroFrame = idx;
    if (!state.ready) { state.ready = true; hero.classList.add('is-ready'); }
  }
  function loadFrame(i) {
    return new Promise((res) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = () => { frames[i] = img; state.framesLoaded++; if (Math.abs(i - targetFrame) < 2 || lastDrawn < 0) drawFrame(Math.round(currentFrame), true); res(true); };
      img.onerror = () => res(false);
      img.src = FRAME_PATH(i + 1);
    });
  }
  function loadFrames() {
    const order = [], seen = new Set([0]);
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < FRAME_COUNT; i += Math.max(step, FRAME_STEP)) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (FRAME_STEP > 1) order.push(FRAME_COUNT - 1);
    let cursor = 0; const CONC = 6;
    const next = () => { if (cursor >= order.length) return; const i = order[cursor++]; loadFrame(i).then(next); };
    loadFrame(0).then((ok) => { if (!ok) { framesMissing = true; state.ready = true; hero.classList.add('is-ready', 'no-frames'); paintFallback(canvas.clientWidth, canvas.clientHeight); return; } for (let k = 0; k < CONC; k++) next(); });
  }
  function drawTick() {
    currentFrame = lerp(currentFrame, targetFrame, prefersReduced ? 1 : 0.28);
    if (Math.abs(currentFrame - targetFrame) < 0.05) { currentFrame = targetFrame; drawLoop = false; }
    drawFrame(Math.round(currentFrame));
    if (drawLoop) requestAnimationFrame(drawTick);
  }
  function setTargetFrame(p) { targetFrame = Math.round(p * (FRAME_COUNT - 1)); if (framesMissing) { state.heroFrame = targetFrame; return; } if (!drawLoop) { drawLoop = true; requestAnimationFrame(drawTick); } }

  /* Partículas reactivas al cursor */
  const pc = $('#heroParticles'); const pctx = pc.getContext('2d');
  let parts = [], mouse = { x: -9999, y: -9999, active: false }, pW = 0, pH = 0;
  function sizeParticles() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
    pW = pc.clientWidth; pH = pc.clientHeight; pc.width = Math.round(pW * dpr); pc.height = Math.round(pH * dpr); pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const N = isMobile() ? 40 : 110;
    parts = Array.from({ length: N }, () => ({ x: Math.random() * pW, y: Math.random() * pH, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18, r: Math.random() * 1.3 + .4, a: Math.random() * .5 + .25, c: Math.random() < .2 }));
    state.particles = N;
  }
  let heroP = 0;
  function particlesTick() {
    pctx.clearRect(0, 0, pW, pH);
    const density = 0.35 + 0.65 * smooth(0.05, 0.6, heroP);
    for (const p of parts) {
      if (mouse.active) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy; if (d2 < 32000 && d2 > 1) { const d = Math.sqrt(d2), f = (180 - d) / 180 * 0.06; p.vx += dx / d * f; p.vy += dy / d * f; } }
      p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = pW + 10; if (p.x > pW + 10) p.x = -10; if (p.y < -10) p.y = pH + 10; if (p.y > pH + 10) p.y = -10;
      pctx.beginPath(); pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pctx.fillStyle = p.c ? `rgba(96,211,230,${p.a * density})` : `rgba(157,139,255,${p.a * density})`; pctx.fill();
    }
    if (mouse.active) {
      pctx.strokeStyle = 'rgba(123,97,255,.16)'; pctx.lineWidth = .6;
      for (const p of parts) { const dx = p.x - mouse.x, dy = p.y - mouse.y; if (dx * dx + dy * dy < 22000) { pctx.beginPath(); pctx.moveTo(mouse.x, mouse.y); pctx.lineTo(p.x, p.y); pctx.stroke(); } }
    }
  }
  if (!prefersReduced) {
    hero.addEventListener('mousemove', (e) => { const r = pc.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true; });
    hero.addEventListener('mouseleave', () => { mouse.active = false; });
    liveWhileVisible(hero, particlesTick);
  }

  /* Coreografía de la red */
  const ONE_AT = 0.06, TEAM_AT = 0.14;
  const AG = [0.20, 0.24, 0.28, 0.32, 0.36, 0.40];                     // INVESTIGACIÓN, RAZONAMIENTO, PROGRAMACIÓN, ANÁLISIS, AUTOMATIZACIÓN, VALIDACIÓN
  const LK = [0.42, 0.45, 0.48, 0.51, 0.54, 0.57, 0.60];               // enlaces agente ↔ agente
  const DELEG_AT = 0.62, EXEC_AT = 0.70, DONE_AT = 0.80, FINAL_AT = 0.88;
  const STAGES = [[0, '00', 'SISTEMA EN ESPERA'], [ONE_AT, '01', 'UN AGENTE DE IA'], [AG[0], '02', 'AGENTES ESPECIALIZADOS'], [LK[0], '03', 'LOS AGENTES SE COMUNICAN'], [DELEG_AT, '04', 'COLABORACIÓN Y DELEGACIÓN'], [DONE_AT, '05', 'TAREA EMPRESARIAL COMPLETADA']];
  const LOG = [
    [ONE_AT, 'AGENTE 01', 'PROCESANDO'], [AG[0], 'AGENTE DE INVESTIGACIÓN', 'ACTIVO'], [AG[1], 'AGENTE DE RAZONAMIENTO', 'ACTIVO'], [AG[2], 'AGENTE DE PROGRAMACIÓN', 'ACTIVO'],
    [AG[3], 'AGENTE DE ANÁLISIS', 'ACTIVO'], [AG[4], 'AGENTE DE AUTOMATIZACIÓN', 'ACTIVO'], [AG[5], 'AGENTE DE VALIDACIÓN', 'ACTIVO'],
    [LK[0], 'CANAL INVESTIGACIÓN → RAZONAMIENTO', 'ABIERTO'], [LK[3], 'INTERCAMBIO DE DATOS', 'EN CURSO'], [LK[6], 'RED DE AGENTES', 'CONECTADA'],
    [DELEG_AT, 'ORQUESTADOR', 'DELEGANDO TAREAS'], [EXEC_AT, 'AGENTES', 'EJECUTANDO'], [0.76, 'VALIDACIÓN', 'RESULTADO VERIFICADO'], [DONE_AT, 'SISTEMA', 'SOLUCIÓN ENTREGADA'], [FINAL_AT, 'HUMANO', 'ORQUESTA EL SISTEMA', true],
  ];
  const logEls = LOG.map(([, k, v, human]) => { const li = document.createElement('li'); li.innerHTML = `${k}<b>${v}</b>`; if (human) li.classList.add('is-human'); heroLog.appendChild(li); return li; });
  const linkLen = links.map((l) => l.getTotalLength());
  links.forEach((l, i) => { l.style.strokeDasharray = linkLen[i]; l.style.strokeDashoffset = linkLen[i]; });
  const packetPath = packets.map((c) => $('#' + c.dataset.path));

  // Pila móvil: UN AGENTE ↓ AGENTES ESPECIALIZADOS ↓ COMUNICACIÓN ↓ COLABORACIÓN ↓ SISTEMA COMPLETO
  const stack = document.createElement('ul'); stack.className = 'hero__stack'; stack.setAttribute('aria-hidden', 'true');
  const STACK = [['Un agente de IA', ONE_AT, 'sep'], ['Investigación', AG[0]], ['Razonamiento', AG[1]], ['Programación', AG[2]], ['Análisis', AG[3]], ['Automatización', AG[4]], ['Validación', AG[5]], ['↓ Los agentes se comunican', LK[0], 'sep'], ['↓ Colaboración y delegación', DELEG_AT, 'sep'], ['↓ Sistema completo de IA', DONE_AT, 'sep']];
  const stackEls = STACK.map(([t, , kind]) => { const li = document.createElement('li'); if (kind === 'sep') li.className = 'stack__sep'; else li.innerHTML = '<i></i>'; li.appendChild(document.createTextNode(t)); stack.appendChild(li); return li; });
  $('.hero__sticky').appendChild(stack);

  let heroLiveP = 0;
  function heroLive(now) {
    const t0 = now / 1000;
    packets.forEach((c, k) => {
      const path = packetPath[k], L = linkLen[k];
      const t = ((t0 * 0.2) + k * 0.19) % 1;
      const pt = path.getPointAtLength(t * L); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
      const drawn = heroLiveP >= LK[k] + 0.05;
      c.style.opacity = drawn ? (heroLiveP >= FINAL_AT ? 0.45 : 1) : 0;
    });
  }

  function heroUpdate(p) {
    state.heroProgress = p; heroP = p;
    heroBar.style.width = (p * 100).toFixed(2) + '%';
    setTargetFrame(p);

    // Título: CONSTRUYE CON IA. → NO SOLO UN AGENTE. UN EQUIPO DE AGENTES.
    const team = p >= TEAM_AT; hero.classList.toggle('is-team', team); state.heroTeam = team;
    $('#heroT2').setAttribute('aria-hidden', String(!team)); $('#heroT1').setAttribute('aria-hidden', String(team));
    const copyT = 1 - smooth(0.30, 0.42, p);
    heroCopy.style.opacity = copyT; heroCopy.style.transform = `translateY(${(1 - copyT) * 40}px)`; heroCopy.style.pointerEvents = copyT > 0.2 ? 'auto' : 'none';

    // Etapa
    let st = STAGES[0]; for (const s of STAGES) if (p >= s[0]) st = s;
    if (state.heroStage !== st[2]) { state.heroStage = st[2]; heroStageIdx.textContent = st[1]; heroStageTxt.textContent = st[2]; }
    const shown = LOG.map((l) => p >= l[0]); const lastIdx = shown.lastIndexOf(true);
    logEls.forEach((li, i) => li.classList.toggle('is-in', shown[i] && i > lastIdx - 6));

    // Agente 01 / Orquestador (nodo central)
    const orchT = smooth(ONE_AT, ONE_AT + 0.05, p); orch.style.opacity = orchT;
    const orchOn = p >= ONE_AT; orch.classList.toggle('is-on', orchOn); state.orchOn = orchOn;
    const role = p >= DELEG_AT ? 'ORQUESTADOR' : 'AGENTE 01';
    if (state.orchRole !== role) { state.orchRole = role; orchName.textContent = role; }
    const os = !orchOn ? 'EN ESPERA' : (p >= DONE_AT ? 'TAREA COMPLETADA' : (p >= EXEC_AT ? 'COORDINANDO' : (p >= DELEG_AT ? 'DELEGANDO' : (p >= AG[0] ? 'CONVOCANDO EQUIPO' : 'PROCESANDO'))));
    if (orchState.textContent !== os) orchState.textContent = os;
    orch.classList.toggle('is-busy', orchOn && p < DONE_AT);

    // Agentes especializados
    let on = 0;
    agents.forEach((a, i) => {
      const t = smooth(AG[i], AG[i] + 0.035, p); a.style.opacity = t;
      const isOn = p >= AG[i]; a.classList.toggle('is-on', isOn); if (isOn) on++;
      const busy = isOn && p >= EXEC_AT && p < DONE_AT; a.classList.toggle('is-busy', busy);
      const txt = !isOn ? 'EN ESPERA' : (p >= DONE_AT ? (i === 5 ? 'VERIFICADO' : 'COMPLETADO') : (p >= EXEC_AT ? 'EJECUTANDO' : (p >= DELEG_AT ? 'TAREA ASIGNADA' : (p >= LK[0] ? 'COMUNICANDO' : 'ACTIVO'))));
      const stEl = $('.agent__state', a); if (stEl.textContent !== txt) stEl.textContent = txt;
    });
    state.agentsOn = on;
    stackEls.forEach((li, i) => li.classList.toggle('is-on', p >= STACK[i][1]));

    // Enlaces entre agentes
    let linksOn = 0;
    links.forEach((l, k) => { const t = smooth(LK[k], LK[k] + 0.05, p); l.style.strokeDashoffset = linkLen[k] * (1 - t); if (t >= 1) linksOn++; });
    state.linksOn = linksOn;
    // Radios del orquestador (delegación)
    spokes.forEach((s, i) => { s.style.opacity = smooth(DELEG_AT + i * 0.012, DELEG_AT + 0.05 + i * 0.012, p) * (p >= FINAL_AT ? 0.4 : 0.9); });

    heroLiveP = p;
    if (p >= LK[0] && !prefersReduced) liveAdd(heroLive); else { liveRemove(heroLive); packets.forEach((c) => { c.style.opacity = 0; }); }

    // Estado final
    const fin = p >= FINAL_AT; heroFinal.classList.toggle('is-in', fin); state.heroFinal = fin;
    net.style.opacity = 1 - 0.88 * smooth(FINAL_AT, 1, p);
    if (fin && !state.hudCounted) { state.hudCounted = true; runCounters(heroHud); }
  }

  function runCounters(root) {
    $$('[data-counter]', root).forEach((el) => {
      if (el.dataset.done) return;
      const target = Number(el.dataset.counter), start = performance.now(), dur = prefersReduced ? 0 : 1500;
      const step = (now) => { const t = dur ? clamp((now - start) / dur, 0, 1) : 1; const e = 1 - Math.pow(1 - t, 3); el.textContent = String(Math.round(target * e)); if (t < 1) requestAnimationFrame(step); else { el.dataset.done = '1'; state.countersDone++; } };
      requestAnimationFrame(step);
    });
  }

  scene(hero, heroUpdate);
  if (prefersReduced) heroUpdate(1);

  /* ---------------------------------------------------------
     02 · RED INTERACTIVA DE AGENTES
     --------------------------------------------------------- */
  const NET = [
    { id: 'orq', name: 'AGENTE ORQUESTADOR', tag: 'Agente orquestador', short: 'ORQUESTADOR', x: 450, y: 280, body: 'Coordina el trabajo de todos los agentes para alcanzar un objetivo común.', meta: [['Rol', 'Coordinación'], ['Recibe', 'Objetivo de negocio'], ['Entrega', 'Solución completa']] },
    { id: 'inv', name: 'AGENTE DE INVESTIGACIÓN', tag: 'Agente especializado', short: 'INVESTIGACIÓN', x: 150, y: 120, body: 'Encuentra, analiza y sintetiza información para alimentar decisiones.', meta: [['Rol', 'Investigación'], ['Recibe', 'Pregunta o hipótesis'], ['Entrega', 'Síntesis con fuentes']] },
    { id: 'raz', name: 'AGENTE DE RAZONAMIENTO', tag: 'Agente especializado', short: 'RAZONAMIENTO', x: 750, y: 120, body: 'Descompone problemas complejos y ayuda a encontrar soluciones.', meta: [['Rol', 'Razonamiento'], ['Recibe', 'Problema complejo'], ['Entrega', 'Plan de solución']] },
    { id: 'pro', name: 'AGENTE DE PROGRAMACIÓN', tag: 'Agente especializado', short: 'PROGRAMACIÓN', x: 120, y: 430, body: 'Construye, modifica y analiza software.', meta: [['Rol', 'Desarrollo'], ['Recibe', 'Especificación'], ['Entrega', 'Código funcional']] },
    { id: 'aut', name: 'AGENTE DE AUTOMATIZACIÓN', tag: 'Agente especializado', short: 'AUTOMATIZACIÓN', x: 780, y: 430, body: 'Conecta herramientas y ejecuta procesos empresariales.', meta: [['Rol', 'Ejecución'], ['Recibe', 'Proceso definido'], ['Entrega', 'Tarea ejecutada']] },
    { id: 'val', name: 'AGENTE DE VALIDACIÓN', tag: 'Agente especializado', short: 'VALIDACIÓN', x: 450, y: 505, body: 'Comprueba resultados, detecta errores y mejora la calidad.', meta: [['Rol', 'Control de calidad'], ['Recibe', 'Resultado'], ['Entrega', 'Resultado verificado']] },
  ];
  const NET_LINKS = [['orq', 'inv'], ['orq', 'raz'], ['orq', 'pro'], ['orq', 'aut'], ['orq', 'val'], ['inv', 'raz'], ['raz', 'aut'], ['aut', 'val'], ['val', 'pro'], ['pro', 'inv']];
  const netSvg = $('#netSvg'), netPanel = $('#netPanel');
  const nnLinkEls = [], nnNodeEls = {};
  if (netSvg) {
    const byId = Object.fromEntries(NET.map((n) => [n.id, n]));
    const gL = svgEl('g', {}, netSvg), gF = svgEl('g', {}, netSvg), gN = svgEl('g', {}, netSvg), gP = svgEl('g', {}, netSvg);
    NET_LINKS.forEach(([a, b]) => {
      const A = byId[a], B = byId[b]; const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.12, my = (A.y + B.y) / 2 - (B.x - A.x) * 0.12;
      const d = `M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`;
      const path = svgEl('path', { class: 'nn__link', d }, gL); path.dataset.a = a; path.dataset.b = b;
      const flow = svgEl('path', { class: 'nn__flow', d }, gF);
      const pk = svgEl('circle', { class: 'nn__packet', r: 3 }, gP);
      nnLinkEls.push({ path, flow, pk, a, b, len: path.getTotalLength(), phase: Math.random() });
    });
    NET.forEach((n) => {
      const isO = n.id === 'orq';
      const g = svgEl('g', { class: 'nn__node' + (isO ? ' nn__node--orch' : ''), transform: `translate(${n.x} ${n.y})`, tabindex: '0', role: 'button', 'aria-label': `${n.name}: ${n.body}` }, gN);
      svgEl('circle', { class: 'h', r: isO ? 64 : 46 }, g);
      if (isO) svgEl('circle', { class: 'ring2', r: 38 }, g);
      svgEl('circle', { class: 'r', r: isO ? 26 : 18 }, g);
      svgEl('circle', { class: 'c', r: isO ? 7 : 5 }, g);
      const label = svgEl('text', { y: isO ? -50 : -32, 'text-anchor': 'middle' }, g); label.textContent = n.short;
      const desc = svgEl('text', { class: 'd', y: isO ? 66 : 42, 'text-anchor': 'middle' }, g); desc.textContent = isO ? 'COORDINA' : 'ESPECIALIZADO';
      nnNodeEls[n.id] = g;
      const activate = () => setNetActive(n.id);
      g.addEventListener('mouseenter', () => { activate(); state.netHovers++; });
      g.addEventListener('focus', activate);
      g.addEventListener('click', activate);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });
    netSvg.addEventListener('mouseleave', () => setNetActive('orq'));
    let switching = null;
    function setNetActive(id) {
      if (state.netActive === id) return;
      state.netActive = id;
      Object.entries(nnNodeEls).forEach(([k, g]) => g.classList.toggle('is-active', k === id));
      nnLinkEls.forEach((l) => l.path.classList.toggle('is-hot', l.a === id || l.b === id));
      const n = byId[id];
      netPanel.classList.add('is-switching'); clearTimeout(switching);
      switching = setTimeout(() => {
        $('#netPanelTag').textContent = n.tag; $('#netPanelTitle').textContent = n.name; $('#netPanelBody').textContent = n.body;
        $('#netPanelMeta').innerHTML = n.meta.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join('');
        netPanel.classList.remove('is-switching');
      }, prefersReduced ? 0 : 180);
    }
    setNetActive('orq');
    liveWhileVisible(netSvg, (now) => {
      const t0 = now / 1000;
      nnLinkEls.forEach((l, k) => {
        const hot = l.path.classList.contains('is-hot');
        const t = ((t0 * (hot ? 0.3 : 0.12)) + l.phase) % 1;
        const pt = l.path.getPointAtLength(t * l.len);
        l.pk.setAttribute('cx', pt.x); l.pk.setAttribute('cy', pt.y);
        l.pk.style.opacity = hot ? 1 : (k < 5 ? 0.55 : 0.25);
        l.flow.style.strokeDashoffset = -((t0 * 30) % 16);
      });
    });
  }

  /* ---------------------------------------------------------
     03 · TRANSFORMACIÓN — progresión fijada
     --------------------------------------------------------- */
  const transform = $('#transformacion');
  const stages = $$('#trStages .stage'), trRail = $('#trRail'), trIdx = $('#trIdx');
  function trUpdate(p) {
    const idx = clamp(Math.floor(p * 6.4), 0, 5);
    if (idx !== state.trIndex || p === 0) { state.trIndex = idx; stages.forEach((s, i) => { s.classList.toggle('is-active', i === idx); s.classList.toggle('is-done', i < idx); }); trIdx.textContent = String(idx + 1).padStart(2, '0'); }
    trRail.style.width = (clamp(p / 0.94, 0, 1) * 100).toFixed(1) + '%';
  }
  const trScene = scene(transform, trUpdate);
  if (isMobile()) { stages.forEach((s) => { s.classList.add('is-active'); revealIO.observe(s); s.classList.add('reveal'); }); }
  else trUpdate(0);

  /* ---------------------------------------------------------
     04 · PROGRAMA — misión horizontal fijada (vertical en móvil)
     --------------------------------------------------------- */
  const program = $('#programa'), prTrack = $('#prTrack'), months = $$('.month', prTrack), prLine = $('#prLine'), prIdx = $('#prIdx'), prPct = $('#prPct');
  function prUpdate(p) {
    const vp = $('.program__viewport');
    if (!isMobile()) {
      const max = Math.max(0, prTrack.scrollWidth - vp.clientWidth + parseFloat(getComputedStyle(vp).paddingLeft));
      const x = -max * smooth(0.08, 0.92, p); state.prX = x;
      prTrack.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    } else { prTrack.style.transform = ''; program.style.setProperty('--vp', (p * 100).toFixed(1) + '%'); }
    const idx = clamp(Math.floor(p * 4.4), 0, 3);
    state.prIndex = idx; months.forEach((m, i) => m.classList.toggle('is-on', i <= idx));
    prLine.style.width = (clamp(p / 0.92, 0, 1) * 100).toFixed(1) + '%';
    prIdx.textContent = `MES 0${idx + 1}`; prPct.textContent = Math.round(p * 100);
  }
  if (isMobile()) vscene(program, prUpdate); else { scene(program, prUpdate); prUpdate(0); }

  /* ---------------------------------------------------------
     05 · GALERÍA HORIZONTAL DE PROYECTOS
     --------------------------------------------------------- */
  const gallery = $('#gallery'), galleryBar = $('#galleryBar'), pcards = $$('.pcard', gallery);
  function galleryUpdate() {
    const max = gallery.scrollWidth - gallery.clientWidth; const p = max > 0 ? gallery.scrollLeft / max : 0;
    const w = 1 / pcards.length; galleryBar.style.width = (w * 100) + '%'; galleryBar.style.transform = `translateX(${(p * (1 - w) / w * 100).toFixed(2)}%)`;
    state.galleryIndex = Math.round(p * (pcards.length - 1));
    $('#pjPrev').disabled = gallery.scrollLeft <= 2; $('#pjNext').disabled = gallery.scrollLeft >= max - 2;
  }
  gallery.addEventListener('scroll', galleryUpdate, { passive: true });
  const cardStep = () => pcards[0].offsetWidth + parseFloat(getComputedStyle(gallery).columnGap || getComputedStyle(gallery).gap || 24);
  $('#pjNext').addEventListener('click', () => gallery.scrollBy({ left: cardStep(), behavior: 'smooth' }));
  $('#pjPrev').addEventListener('click', () => gallery.scrollBy({ left: -cardStep(), behavior: 'smooth' }));
  gallery.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') gallery.scrollBy({ left: cardStep(), behavior: 'smooth' }); if (e.key === 'ArrowLeft') gallery.scrollBy({ left: -cardStep(), behavior: 'smooth' }); });
  let drag = null;
  gallery.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, sl: gallery.scrollLeft, moved: false }; });
  window.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4 && !drag.moved) { drag.moved = true; gallery.classList.add('is-dragging'); } if (drag.moved) gallery.scrollLeft = drag.sl - dx; });
  window.addEventListener('pointerup', () => { if (!drag) return; drag = null; gallery.classList.remove('is-dragging'); });
  // Rueda vertical sobre la galería → desplazamiento horizontal (solo en escritorio)
  gallery.addEventListener('wheel', (e) => { if (isMobile() || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; const max = gallery.scrollWidth - gallery.clientWidth; const atEdge = (e.deltaY > 0 && gallery.scrollLeft >= max - 1) || (e.deltaY < 0 && gallery.scrollLeft <= 1); if (atEdge) return; e.preventDefault(); gallery.scrollLeft += e.deltaY; }, { passive: false });
  galleryUpdate();

  /* ---------------------------------------------------------
     VIDEOS — carga diferida + reproducción solo en pantalla
     --------------------------------------------------------- */
  $$('video[preload="none"]').forEach((v) => {
    const host = v.closest('section, article') || v.parentElement; let loaded = false;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        if (!loaded) { loaded = true; $$('source', v).forEach((s) => { s.src = s.dataset.src; }); v.load(); }
        if (!prefersReduced) v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    }), { rootMargin: '25% 0px' });
    io.observe(v);
    v.addEventListener('playing', () => { host.classList.add('is-playing'); if (!state.videosPlaying.includes(v.id)) state.videosPlaying.push(v.id); });
    v.addEventListener('pause', () => { state.videosPlaying = state.videosPlaying.filter((id) => id !== v.id); });
    v.addEventListener('error', () => { host.classList.add('video-missing'); }, true);
  });

  /* ---------------------------------------------------------
     06 · TARJETA DE CERTIFICACIÓN — reveal + tilt + brillo
     --------------------------------------------------------- */
  const certWrap = $('#certWrap'), certCard = $('#certCard');
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { certWrap.classList.add('is-in'); state.certIn = true; } }), { threshold: 0.35 }).observe(certWrap);
  if (finePointer && !prefersReduced) {
    certWrap.addEventListener('mousemove', (e) => {
      const r = certCard.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      certCard.style.transform = `rotateY(${((x - .5) * 10).toFixed(2)}deg) rotateX(${((.5 - y) * 8).toFixed(2)}deg)`;
      certCard.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); certCard.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    certWrap.addEventListener('mouseleave', () => { certCard.style.transform = ''; });
  }

  /* ---------------------------------------------------------
     07 · RED DE ACOMPAÑAMIENTO
     --------------------------------------------------------- */
  const supSvg = $('#supSvg');
  if (supSvg) {
    const C = { x: 300, y: 300 };
    const NODES = [['INSTRUCTOR', 300, 62], ['MENTORÍA', 505, 196], ['COMUNIDAD', 470, 500], ['PREPARACIÓN', 130, 500], ['PRÁCTICA', 95, 196]];
    const gL = svgEl('g', {}, supSvg), gN = svgEl('g', {}, supSvg), gP = svgEl('g', {}, supSvg);
    const items = NODES.map(([label, x, y], i) => {
      svgEl('path', { class: 'sn__link', d: `M${x} ${y} L${C.x} ${C.y}` }, gL);
      const draw = svgEl('path', { class: 'sn__draw', d: `M${x} ${y} L${C.x} ${C.y}` }, gL); const len = draw.getTotalLength(); draw.style.strokeDasharray = len; draw.style.strokeDashoffset = len; draw.style.transition = `stroke-dashoffset 1.1s var(--ease-out) ${0.35 + i * 0.16}s`;
      const g = svgEl('g', { class: 'sn__node', transform: `translate(${x} ${y})` }, gN); g.style.transitionDelay = `${0.15 + i * 0.16}s`;
      svgEl('circle', { class: 'r', r: 20 }, g); svgEl('circle', { class: 'c', r: 5 }, g);
      const t = svgEl('text', { y: y > 450 ? 48 : -34, 'text-anchor': 'middle' }, g); t.textContent = label;
      const pk = svgEl('circle', { class: 'sn__pk', r: 3.2 }, gP);
      return { g, draw, pk, x, y, len, path: draw };
    });
    const center = svgEl('g', { class: 'sn__center', transform: `translate(${C.x} ${C.y})` }, gN);
    svgEl('circle', { class: 'ring', r: 58 }, center); svgEl('circle', { class: 'r', r: 40 }, center); svgEl('circle', { class: 'c', r: 8 }, center);
    const ct = svgEl('text', { y: -70, 'text-anchor': 'middle' }, center); ct.textContent = 'CERTIFICACIÓN';
    const cd = svgEl('text', { class: 'd', y: 84, 'text-anchor': 'middle' }, center); cd.textContent = 'HASTA QUE APRUEBES';
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { state.supportIn = true; items.forEach((it) => { it.g.classList.add('is-in'); it.draw.style.strokeDashoffset = 0; }); state.supportLinks = items.length; } }), { threshold: 0.4 }).observe(supSvg);
    liveWhileVisible(supSvg, (now) => { if (!state.supportIn) return; const t0 = now / 1000; items.forEach((it, i) => { const t = ((t0 * 0.28) + i * 0.2) % 1; const pt = it.path.getPointAtLength(t * it.len); it.pk.setAttribute('cx', pt.x); it.pk.setAttribute('cy', pt.y); it.pk.style.opacity = t > 0.05 && t < 0.95 ? 1 : 0; }); });
  }

  /* ---------------------------------------------------------
     08 · PERFIL — ensamblaje de componentes
     --------------------------------------------------------- */
  const profileUi = $('#profileUi');
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !state.profileIn) { state.profileIn = true; profileUi.classList.add('is-in'); const c = $('#puiCount'); let n = 0; const tick = () => { n++; c.textContent = n; if (n < 6) setTimeout(tick, prefersReduced ? 0 : 160); }; setTimeout(tick, prefersReduced ? 0 : 500); } }), { threshold: 0.3 }).observe(profileUi);

  /* ---------------------------------------------------------
     09 · LAUNCHPAD — perfiles ↔ entornos empresariales
     --------------------------------------------------------- */
  const lpSvg = $('#lpSvg');
  if (lpSvg) {
    const PROFILES = [[215, 70], [215, 150], [215, 230]], HUB = [520, 150];
    const ENVS = [['EMPRESA', 860, 55], ['STARTUP', 860, 120], ['CONSULTORÍA', 860, 185], ['PROYECTO PROPIO', 860, 250]];
    const gL = svgEl('g', {}, lpSvg), gN = svgEl('g', {}, lpSvg), gP = svgEl('g', {}, lpSvg); const linkEls = [];
    PROFILES.forEach(([x, y], i) => {
      const d = `M${x + 24} ${y} C ${x + 200} ${y}, ${HUB[0] - 200} ${HUB[1]}, ${HUB[0] - 44} ${HUB[1]}`;
      const p = svgEl('path', { class: 'lp__link', d }, gL); linkEls.push({ p, len: p.getTotalLength(), pk: svgEl('circle', { class: 'lp__pk', r: 2.6 }, gP), phase: i * 0.33 });
      const g = svgEl('g', { class: 'lp__node', transform: `translate(${x} ${y})` }, gN); svgEl('circle', { class: 'r', r: 22 }, g); svgEl('circle', { class: 'c', r: 5 }, g);
      const t = svgEl('text', { x: -34, y: 4, 'text-anchor': 'end' }, g); t.textContent = 'AI DEVELOPER';
    });
    ENVS.forEach(([label, x, y], i) => {
      const d = `M${HUB[0] + 44} ${HUB[1]} C ${HUB[0] + 200} ${HUB[1]}, ${x - 200} ${y}, ${x - 70} ${y}`;
      const p = svgEl('path', { class: 'lp__link', d }, gL); linkEls.push({ p, len: p.getTotalLength(), pk: svgEl('circle', { class: 'lp__pk', r: 2.6 }, gP), phase: 0.5 + i * 0.25 });
      const g = svgEl('g', { class: 'lp__node', transform: `translate(${x} ${y})` }, gN); svgEl('rect', { x: -70, y: -18, width: 140, height: 36 }, g);
      const t = svgEl('text', { y: 4, 'text-anchor': 'middle' }, g); t.textContent = label;
    });
    const hub = svgEl('g', { class: 'lp__node', transform: `translate(${HUB[0]} ${HUB[1]})` }, gN); svgEl('circle', { class: 'r', r: 44 }, hub); svgEl('circle', { class: 'c', r: 7 }, hub);
    const ht = svgEl('text', { y: -56, 'text-anchor': 'middle' }, hub); ht.textContent = 'AI TALENT NETWORK'; const hd = svgEl('text', { class: 'd', y: 66, 'text-anchor': 'middle' }, hub); hd.textContent = 'COMUNIDAD AI LAB';
    liveWhileVisible(lpSvg, (now) => { const t0 = now / 1000; linkEls.forEach((l) => { const t = ((t0 * 0.16) + l.phase) % 1; const pt = l.p.getPointAtLength(t * l.len); l.pk.setAttribute('cx', pt.x); l.pk.setAttribute('cy', pt.y); }); });
  }

  /* ---------------------------------------------------------
     11 · MÉTRICAS — contadores
     --------------------------------------------------------- */
  const metricsGrid = $('#metricsGrid');
  new IntersectionObserver((es, io) => es.forEach((e) => { if (e.isIntersecting) { runCounters(metricsGrid); io.unobserve(metricsGrid); } }), { threshold: 0.4 }).observe(metricsGrid);

  /* Foco de luz en tarjetas */
  if (finePointer) $$('.fcard').forEach((c) => c.addEventListener('mousemove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); }));

  /* ---------------------------------------------------------
     14 · FAQ — acordeón animado (un elemento abierto)
     --------------------------------------------------------- */
  const accs = $$('.acc');
  accs.forEach((d, i) => {
    const summary = $('summary', d), body = $('.acc__body', d);
    summary.setAttribute('aria-expanded', 'false');
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) close(d); else { accs.forEach((o) => { if (o !== d && o.open) close(o); }); open(d, i); }
    });
    function open(el, idx) {
      el.open = true; summary.setAttribute('aria-expanded', 'true'); state.faqOpen = idx;
      if (prefersReduced) return;
      const h = body.scrollHeight; body.style.height = '0px'; el.classList.add('is-animating');
      requestAnimationFrame(() => { body.style.height = h + 'px'; });
      body.addEventListener('transitionend', () => { body.style.height = ''; el.classList.remove('is-animating'); }, { once: true });
    }
    function close(el) {
      const s = $('summary', el), b = $('.acc__body', el); s.setAttribute('aria-expanded', 'false'); if (state.faqOpen === accs.indexOf(el)) state.faqOpen = -1;
      if (prefersReduced) { el.open = false; return; }
      b.style.height = b.scrollHeight + 'px'; el.classList.add('is-animating');
      requestAnimationFrame(() => { b.style.height = '0px'; });
      b.addEventListener('transitionend', () => { el.open = false; b.style.height = ''; el.classList.remove('is-animating'); }, { once: true });
    }
  });

  /* ---------------------------------------------------------
     MODAL · SOLICITUD DE INGRESO
     --------------------------------------------------------- */
  const modal = $('#modal'), form = $('#applyForm'), formOk = $('#formOk'), formErr = $('#formErr');
  const INTENTS = {
    entrar: { tag: 'Solicitud de ingreso', title: 'Quiero entrar al programa', body: 'Cuéntanos quién eres. Un asesor de AI LAB te contactará para explicarte el programa, las fechas de la próxima generación y el proceso de inscripción.', cta: 'Solicitar mi lugar' },
    camino: { tag: 'Comienza tu camino', title: 'Comienza tu camino como AI Developer', body: 'Déjanos tus datos y te compartimos la ruta completa del programa, el detalle de los proyectos y cómo funciona el acompañamiento hasta aprobar.', cta: 'Comenzar mi camino' },
    developer: { tag: 'Próxima generación', title: 'Quiero convertirme en AI Developer', body: 'Solicita tu lugar en la próxima generación. Te contactaremos para confirmar disponibilidad, fechas y opciones de inscripción. Inversión: $8,000 MXN con examen oficial incluido.', cta: 'Quiero mi lugar' },
  };
  let lastFocus = null;
  function openModal(intent) {
    const cfg = INTENTS[intent] || INTENTS.entrar; lastFocus = document.activeElement;
    $('#modalTag').innerHTML = `<span class="tag__bar"></span>${cfg.tag}`; $('#modalTitle').textContent = cfg.title; $('#modalBody').textContent = cfg.body;
    $('.form__submit span', form).textContent = cfg.cta; $('#formIntent').value = intent;
    form.hidden = false; formOk.hidden = true; formErr.hidden = true; $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
    modal.hidden = false; document.body.style.overflow = 'hidden'; state.modalOpen = true;
    nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false');
    setTimeout(() => $('input[name=name]', form).focus(), 60);
  }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ''; state.modalOpen = false; if (lastFocus) lastFocus.focus(); }
  $$('[data-open-modal]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.intent)));
  $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, input, select, textarea, [href]', modal).filter((el) => !el.hidden && el.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    ['name', 'email', 'phone', 'profile'].forEach((n) => {
      const el = form.elements[n]; const v = el.value.trim();
      const valid = n === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : (n === 'phone' ? v.replace(/\D/g, '').length >= 10 : v.length > 1);
      el.classList.toggle('is-invalid', !valid); if (!valid) ok = false;
    });
    formErr.hidden = ok; if (!ok) { $('.is-invalid', form).focus(); return; }
    const btn = $('.form__submit', form); btn.disabled = true; $('span', btn).textContent = 'Enviando…';
    const payload = Object.fromEntries(new FormData(form).entries()); payload.program = 'Claude Developer Certification Program'; payload.source = location.href;
    const endpoint = form.dataset.endpoint;
    try {
      if (endpoint) { const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!r.ok) throw new Error('HTTP ' + r.status); }
      else await new Promise((r) => setTimeout(r, 700)); // Envío simulado: conecta tu CRM en data-endpoint
      form.hidden = true; formOk.hidden = false; state.submitted = true; $('.form__ok .btn').focus();
    } catch (err) {
      formErr.textContent = 'No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.'; formErr.hidden = false;
    } finally { btn.disabled = false; $('span', btn).textContent = (INTENTS[$('#formIntent').value] || INTENTS.entrar).cta; }
  });

  /* ---------------------------------------------------------
     Botones magnéticos + cursor
     --------------------------------------------------------- */
  if (finePointer && !prefersReduced) {
    $$('.btn--magnetic').forEach((b) => {
      b.addEventListener('mousemove', (e) => { const r = b.getBoundingClientRect(); const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height; b.style.transform = `translate(${(dx * 10).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`; });
      b.addEventListener('mouseleave', () => { b.style.transform = ''; });
    });
    const cur = $('#cursor'); let cx = -100, cy = -100, tx = cx, ty = cy; document.body.classList.add('has-cursor');
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; const t = e.target.closest && e.target.closest('a, button, summary, [role=button], .pcard, .gallery'); cur.classList.toggle('is-hover', !!t); }, { passive: true });
    document.addEventListener('mouseleave', () => { tx = -100; ty = -100; });
    liveAdd(() => { cx = lerp(cx, tx, 0.22); cy = lerp(cy, ty, 0.22); cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)${cur.classList.contains('is-hover') ? ' scale(1.6)' : ''}`; });
  }

  /* ---------------------------------------------------------
     Arranque
     --------------------------------------------------------- */
  $('#year').textContent = new Date().getFullYear();
  function layout() { sizeCanvas(); sizeParticles(); measure(); frame(); galleryUpdate(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
  window.addEventListener('load', () => { measure(); frame(); });
  layout(); loadFrames();
  // Al salir del hero desde un enlace de la nav, evita saltos de medida por fuentes cargadas tarde
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); frame(); });
})();
