/* =========================================================
   AI LAB — Certificación en Claude Code
   Interaction layer (no dependencies)
   ========================================================= */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* Exposed state for verification/tests */
  const state = { heroProgress: 0, heroFrame: 0, framesLoaded: 0, frameCount: 0, poderIndex: 0, ready: false };
  window.__ailab = state;

  /* ---------------------------------------------------------
     1. HERO — scroll-scrubbed frame sequence on <canvas>
     --------------------------------------------------------- */
  const hero = $('#hero');
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const heroContent = $('.hero__content');
  const heroFade = $('#heroFade');
  const heroBar = $('#heroProgressBar');
  const heroStatusText = $('#heroStatusText');

  const FRAME_COUNT = Number(hero.dataset.frames || 120);
  const FRAME_PATH = (i) => `assets/hero/frames/frame_${String(i).padStart(4, '0')}.webp`;
  const frames = new Array(FRAME_COUNT).fill(null);
  let lastDrawn = -1;
  let currentFrame = 0;
  let targetFrame = 0;
  state.frameCount = FRAME_COUNT;

  const statusMessages = [
    [0.00, 'Inicializando entorno…'],
    [0.18, 'Cargando contexto del repositorio…'],
    [0.38, 'Analizando estructura del proyecto…'],
    [0.58, 'Generando código…'],
    [0.78, 'Ejecutando pruebas…'],
    [0.92, 'Entorno listo · Claude Code'],
  ];

  function sizeCanvas() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastDrawn = -1;
    drawFrame(currentFrame, true);
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
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    lastDrawn = idx;
    state.heroFrame = idx;
  }

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; state.framesLoaded++; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = FRAME_PATH(i + 1);
    });
  }

  async function loadFrames() {
    // First frame immediately, then key frames spread across the sequence, then fill in.
    await loadFrame(0);
    drawFrame(0, true);
    const order = [];
    for (let step = 16; step >= 1; step = step >> 1) {
      for (let i = 0; i < FRAME_COUNT; i += step) if (!order.includes(i)) order.push(i);
    }
    const CONCURRENCY = 6;
    let cursor = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < order.length) {
        const i = order[cursor++];
        if (!frames[i]) await loadFrame(i);
        if (state.framesLoaded % 8 === 0) drawFrame(Math.round(currentFrame), true);
      }
    }));
    state.ready = true;
    drawFrame(Math.round(currentFrame), true);
  }

  function heroProgress() {
    const rect = hero.getBoundingClientRect();
    const total = hero.offsetHeight - window.innerHeight;
    return clamp(-rect.top / total, 0, 1);
  }

  function updateHero() {
    const p = heroProgress();
    state.heroProgress = p;
    // Ease the mapping so the assembly reads slower at the end.
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    targetFrame = eased * (FRAME_COUNT - 1);

    // Copy: stays legible for the first third, then drifts up and fades.
    const t = clamp((p - 0.28) / 0.34, 0, 1);
    heroContent.style.opacity = String(1 - t);
    heroContent.style.transform = `translate(-50%, calc(-50% - ${t * 60}px)) scale(${1 - t * 0.04})`;
    heroContent.style.pointerEvents = t > 0.9 ? 'none' : 'auto';

    // Hand-off to the white body.
    const f = clamp((p - 0.86) / 0.14, 0, 1);
    heroFade.style.opacity = String(f);

    heroBar.style.width = `${(p * 100).toFixed(1)}%`;
    let msg = statusMessages[0][1];
    for (const [at, text] of statusMessages) if (p >= at) msg = text;
    if (heroStatusText.textContent !== msg) heroStatusText.textContent = msg;
  }

  /* ---------------------------------------------------------
     2. PODER — three panels pinned over clip 2
     --------------------------------------------------------- */
  const poder = $('#poder');
  const poderPanels = $$('.poder__panel');
  const poderSteps = $$('.poder__step');
  const poderVideo = $('#poderVideo');

  function updatePoder() {
    const rect = poder.getBoundingClientRect();
    const total = poder.offsetHeight - window.innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    const idx = clamp(Math.floor(p * 3 * 0.999), 0, 2);
    if (idx !== state.poderIndex || !poder.dataset.init) {
      poder.dataset.init = '1';
      state.poderIndex = idx;
      poderPanels.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-past', i < idx);
      });
      poderSteps.forEach((el, i) => el.classList.toggle('is-active', i <= idx));
    }
  }

  /* ---------------------------------------------------------
     3. Timeline + journey progress lines
     --------------------------------------------------------- */
  const timeline = $('#timeline');
  const timelineProgress = $('#timelineProgress');
  const tlItems = $$('.tl');
  const journey = $('#journey');
  const journeyProgress = $('#journeyProgress');
  const journeyStages = $$('.journey__stage');

  function sectionProgress(el, startAt = 0.75, endAt = 0.35) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh * startAt;             // progress begins when the element's top passes this line
    const end = vh * endAt;                 // ...and completes when its bottom reaches this line
    return clamp((start - rect.top) / (rect.height + start - end), 0, 1);
  }

  function updateLines() {
    const tp = sectionProgress(timeline, 0.7, 0.4);
    timelineProgress.style.height = `${(tp * 100).toFixed(1)}%`;
    tlItems.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.classList.toggle('is-active', r.top < window.innerHeight * 0.7 && r.bottom > window.innerHeight * 0.4);
    });
    const jp = sectionProgress(journey, 0.8, 0.5);
    journeyProgress.style.width = `${(jp * 100).toFixed(1)}%`;
    journeyStages.forEach((el, i) => el.classList.toggle('is-lit', jp >= (i + 0.5) / journeyStages.length || (i === 0 && jp > 0.02)));
  }

  /* ---------------------------------------------------------
     4. NAV — light theme past the hero, hide on fast scroll down
     --------------------------------------------------------- */
  const nav = $('#nav');
  let lastY = window.scrollY;
  function updateNav() {
    const y = window.scrollY;
    const overDark = isOverDark();
    nav.classList.toggle('is-light', !overDark);
    const dy = y - lastY;
    if (y > 120 && dy > 6) nav.classList.add('is-hidden');
    else if (dy < -4 || y < 120) nav.classList.remove('is-hidden');
    lastY = y;
  }
  const darkSections = ['#hero', '#poder', '#transformacion', '#final'].map((s) => $(s));
  function isOverDark() {
    const probe = 40; // nav mid-height
    return darkSections.some((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    });
  }

  /* ---------------------------------------------------------
     rAF loop — one place that reads scroll and writes DOM
     --------------------------------------------------------- */
  let ticking = false;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }
  function frame() {
    ticking = false;
    updateHero();
    updatePoder();
    updateLines();
    updateNav();
  }
  // Smooth frame interpolation for the hero (runs continuously while the hero is on screen).
  function heroLoop() {
    const onScreen = hero.getBoundingClientRect().bottom > 0;
    if (onScreen) {
      currentFrame = prefersReduced ? targetFrame : lerp(currentFrame, targetFrame, 0.22);
      if (Math.abs(currentFrame - targetFrame) < 0.05) currentFrame = targetFrame;
      drawFrame(Math.round(currentFrame));
    }
    requestAnimationFrame(heroLoop);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { sizeCanvas(); onScroll(); });

  /* ---------------------------------------------------------
     5. Reveal on scroll
     --------------------------------------------------------- */
  const revealEls = $$('[data-reveal]');
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const siblings = Array.from(e.target.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
      const i = siblings.indexOf(e.target);
      e.target.style.setProperty('--d', `${Math.min(i, 7) * 0.07}s`);
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach((el) => revealIO.observe(el));

  /* ---------------------------------------------------------
     6. Counters
     --------------------------------------------------------- */
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function animateCounter(el) {
    const target = Number(el.dataset.count);
    const duration = Number(el.dataset.duration || 1600);
    const start = performance.now();
    function tick(now) {
      const t = clamp((now - start) / duration, 0, 1);
      el.textContent = String(Math.round(easeOutExpo(t) * target));
      if (t < 1) requestAnimationFrame(tick); else el.dataset.done = '1';
    }
    if (prefersReduced) { el.textContent = String(target); el.dataset.done = '1'; return; }
    requestAnimationFrame(tick);
  }
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('.counter', e.target).forEach(animateCounter);
      counterIO.unobserve(e.target);
    });
  }, { threshold: 0.4 });
  counterIO.observe($('#metrics'));

  /* ---------------------------------------------------------
     7. Background videos — play only when visible
     --------------------------------------------------------- */
  function bindVideo(video) {
    if (!video) return;
    const markReady = () => video.classList.add('is-ready');
    video.addEventListener('loadeddata', markReady, { once: true });
    if (video.readyState >= 2) markReady();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { video.play().catch(() => {}); }
        else { video.pause(); }
      });
    }, { threshold: 0.05 });
    io.observe(video);
  }
  bindVideo(poderVideo);
  bindVideo($('#finalVideo'));

  /* ---------------------------------------------------------
     8. FAQ accordion (single-open, keyboard accessible)
     --------------------------------------------------------- */
  const triggers = $$('.acc__trigger');
  function setOpen(btn, open) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  }
  triggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const willOpen = btn.getAttribute('aria-expanded') !== 'true';
      triggers.forEach((b) => { if (b !== btn) setOpen(b, false); });
      setOpen(btn, willOpen);
    });
    btn.addEventListener('keydown', (e) => {
      const i = triggers.indexOf(btn);
      if (e.key === 'ArrowDown') { e.preventDefault(); triggers[(i + 1) % triggers.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); triggers[(i - 1 + triggers.length) % triggers.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); triggers[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); triggers[triggers.length - 1].focus(); }
    });
  });

  /* ---------------------------------------------------------
     9. Spotlight hover on cards
     --------------------------------------------------------- */
  $$('[data-spotlight]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    });
  });

  /* ---------------------------------------------------------
     10. Magnetic buttons
     --------------------------------------------------------- */
  if (!prefersReduced && window.matchMedia('(pointer: fine)').matches) {
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.transform = `translate(${dx * 6}px, ${dy * 6 - 2}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------
     11. CTA modal + lead form
     --------------------------------------------------------- */
  const modal = $('#ctaModal');
  const modalForm = $('#modalForm');
  const modalSuccess = $('#modalSuccess');
  const form = $('#leadForm');
  const formError = $('#formError');
  let lastFocus = null;

  function openModal(trigger) {
    lastFocus = trigger || document.activeElement;
    modal.hidden = false;
    modalForm.hidden = false;
    modalSuccess.hidden = true;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      $('#fNombre').focus();
    });
    modal.dataset.source = (trigger && trigger.id) || 'cta';
  }
  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.hidden = true; if (lastFocus) lastFocus.focus(); }, 320);
  }
  $$('[data-cta]').forEach((btn) => btn.addEventListener('click', () => openModal(btn)));
  $$('[data-modal-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = $$('button, input, [href]', modal).filter((el) => !el.hidden && el.offsetParent !== null);
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('#fNombre'), email = $('#fEmail');
    [nombre, email].forEach((i) => i.classList.remove('is-invalid'));
    formError.hidden = true;
    const errors = [];
    if (nombre.value.trim().length < 3) { errors.push('Escribe tu nombre completo.'); nombre.classList.add('is-invalid'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { errors.push('Escribe un correo válido.'); email.classList.add('is-invalid'); }
    if (errors.length) { formError.textContent = errors.join(' '); formError.hidden = false; (nombre.classList.contains('is-invalid') ? nombre : email).focus(); return; }
    const submit = $('#formSubmit');
    submit.disabled = true; submit.textContent = 'Enviando…';
    // Simulated submission — replace with your CRM / form endpoint.
    setTimeout(() => {
      submit.disabled = false; submit.textContent = 'Enviar solicitud';
      $('#successName').textContent = nombre.value.trim().split(' ')[0];
      modalForm.hidden = true;
      modalSuccess.hidden = false;
      $('#modalSuccess .btn').focus();
      form.reset();
      window.dispatchEvent(new CustomEvent('ailab:lead', { detail: { source: modal.dataset.source } }));
    }, 700);
  });

  /* ---------------------------------------------------------
     12. Logo marquee — duplicate for a seamless loop
     --------------------------------------------------------- */
  const marquee = $('#logoMarquee');
  marquee.innerHTML += marquee.innerHTML;
  $$('.logo', marquee).slice(marquee.children.length / 2).forEach((el) => el.setAttribute('aria-hidden', 'true'));

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  sizeCanvas();
  loadFrames();
  frame();
  if (!prefersReduced) heroLoop(); else {
    window.addEventListener('scroll', () => { currentFrame = targetFrame; drawFrame(Math.round(currentFrame)); }, { passive: true });
  }
})();
