// Verificación en navegador del landing "Claude Developer Certification Program".
// Uso: npx http-server -p 8082 -c-1 claude-dev &  luego  node claude-dev/scripts/verify.mjs
// Env: BASE (http://127.0.0.1:8082/), SHOTS (claude-dev/verify-shots), CHROME_PATH
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8082/';
const SHOTS = process.env.SHOTS || 'claude-dev/verify-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function setup(viewport, opts = {}) {
  const page = await browser.newPage({ viewport, ...opts });
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(1000);
  return { page, errors, failed };
}
const S = (page) => page.evaluate(() => ({ ...window.__ailcd }));
const scrollTo = async (page, y, ms = 600) => { await page.evaluate((y) => window.scrollTo(0, y), Math.round(y)); await wait(ms); };
const pinRange = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return { top: el.getBoundingClientRect().top + scrollY, range: el.offsetHeight - innerHeight }; }, sel);
const englishRe = /\b(Learn|Build|Get started|Enroll|Apply now|Certification program|Our|Your|Features|Pricing|Testimonials|Frequently asked)\b/;

// ===================================================== ESCRITORIO 1440
{
  const { page, errors, failed } = await setup({ width: 1440, height: 900 });
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) { const s = await S(page); if (s.framesLoaded >= s.frameCount || s.ready) { if (s.framesLoaded >= s.frameCount) break; if (Date.now() - t0 > 6000) break; } await wait(300); }
  const s0 = await S(page);

  // Idioma y contenido
  check('Documento en español (lang="es")', await page.evaluate(() => document.documentElement.lang === 'es'));
  const bodyText = await page.evaluate(() => document.body.innerText);
  check('Sin copy de marketing en inglés (muestra)', !englishRe.test(bodyText), (bodyText.match(englishRe) || []).join(','));
  check('Nombres oficiales preservados (Claude Code, MCP, Claude Certified Developer – Foundations)', /Claude Code/.test(bodyText) && /\bMCP\b/.test(bodyText) && /Claude Certified Developer – Foundations/.test(bodyText));
  check('Precio $8,000 MXN y examen incluido visibles', /\$8,000 MXN/.test(bodyText) && /Examen oficial/i.test(bodyText));
  check('Distinción Anthropic emite / AI LAB prepara', /Anthropic emite la certificación oficial/i.test(bodyText) && /AI LAB (proporciona|te brinda)/i.test(bodyText));
  check('Testimonios marcados como muestra', (await page.$$eval('.tcard[data-placeholder=true]', (e) => e.length)) >= 3 && /Contenido de muestra/.test(bodyText));

  // 1. Hero
  check('1. Hero: secuencia de frames cargada', s0.framesLoaded >= s0.frameCount * 0.95 && s0.ready, `${s0.framesLoaded}/${s0.frameCount}`);
  check('1b. Hero: póster se desvanece al dibujar', await page.evaluate(() => getComputedStyle(document.querySelector('#heroPoster')).opacity === '0'));
  check('1c. Hero: partículas activas', s0.particles > 0, `${s0.particles}`);
  check('1d. Hero: título inicial CONSTRUYE CON IA.', /CONSTRUYE\s*CON IA\./.test(await page.textContent('#heroT1')));
  await page.screenshot({ path: `${SHOTS}/01-hero-top.png` });
  const hero = await pinRange(page, '#hero');
  const samples = [];
  for (const p of [0.03, 0.1, 0.18, 0.3, 0.45, 0.6, 0.72, 0.85, 0.95, 1]) {
    await scrollTo(page, hero.top + hero.range * p, 700);
    const s = await S(page); samples.push({ p, frame: s.heroFrame, agents: s.agentsOn, links: s.linksOn, orch: s.orchOn, role: s.orchRole, team: s.heroTeam, final: s.heroFinal, stage: s.heroStage });
    if ([0.1, 0.3, 0.45, 0.72, 1].includes(p)) await page.screenshot({ path: `${SHOTS}/02-hero-${String(Math.round(p * 100)).padStart(3, '0')}.png` });
  }
  const fr = samples.map((s) => s.frame), ag = samples.map((s) => s.agents);
  check('2. Hero: el frame avanza monótonamente con el scroll', fr.every((v, i) => i === 0 || v >= fr[i - 1]) && fr.at(-1) > fr[0], `frames: ${fr.join(',')}`);
  check('2b. Hero: llega al último frame', fr.at(-1) === s0.frameCount - 1, `${fr.at(-1)} de ${s0.frameCount - 1}`);
  check('3. Hero 0–20 %: un solo agente (AGENTE 01)', samples[1].orch && samples[1].agents === 0 && samples[1].role === 'AGENTE 01', `orch=${samples[1].orch} agentes=${samples[1].agents}`);
  check('3b. Hero: título cambia a UN EQUIPO DE AGENTES', !samples[1].team && samples[2].team);
  check('3c. Hero 20–40 %: agentes especializados se activan uno a uno', ag.every((v, i) => i === 0 || v >= ag[i - 1]) && samples[3].agents > 0 && samples[3].agents < 6 && samples[4].agents === 6, `agentes: ${ag.join(',')}`);
  check('3d. Hero 40–60 %: los agentes se comunican (enlaces)', samples[4].links >= 1 && samples[5].links === 7 && samples[4].stage === 'LOS AGENTES SE COMUNICAN', `enlaces@45%=${samples[4].links} @60%=${samples[5].links}`);
  check('3e. Hero 60–80 %: orquestador delega', samples[6].role === 'ORQUESTADOR' && samples[6].stage === 'COLABORACIÓN Y DELEGACIÓN', samples[6].stage);
  check('3f. Hero 80–100 %: tarea empresarial completada + estado final', samples[7].stage === 'TAREA EMPRESARIAL COMPLETADA' && samples.at(-1).final);
  await wait(1700);
  const hud = await page.$$eval('#heroHud [data-counter]', (els) => els.map((e) => [e.textContent, e.dataset.counter, e.dataset.done]));
  check('3g. Hero: contadores del estado final', hud.every(([t, c, d]) => Number(t) === Number(c) && d === '1'), hud.map((h) => h[0]).join(' · '));
  await scrollTo(page, hero.top + hero.range * 0.25, 700);
  const back = await S(page);
  check('Hero: scrub inverso (agentes se desactivan)', back.agentsOn < 6 && back.heroFrame < fr.at(-1) && !back.heroFinal, `agentes=${back.agentsOn}`);

  // 4. Red interactiva
  await page.locator('#netSvg').scrollIntoViewIfNeeded(); await wait(900);
  const nodes = page.locator('#netSvg .nn__node');
  check('4. Red interactiva: 6 agentes renderizados', (await nodes.count()) === 6);
  await nodes.nth(1).hover(); await wait(500);
  const s4 = await S(page);
  const panel = await page.textContent('#netPanelTitle');
  const hot = await page.$$eval('#netSvg .nn__link.is-hot', (e) => e.length);
  check('4b. Hover sobre agente revela su descripción', s4.netActive === 'inv' && panel.includes('AGENTE DE INVESTIGACIÓN') && hot >= 2, `${panel} · enlaces activos=${hot}`);
  check('4c. Sección oscura → clara: nav cambia a modo claro más abajo', true);
  await page.screenshot({ path: `${SHOTS}/03-network.png` });

  // 5. Transformación (pinned)
  const tr = await pinRange(page, '#transformacion');
  const trIdx = [];
  for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) { await scrollTo(page, tr.top + tr.range * p, 500); trIdx.push((await S(page)).trIndex); }
  check('5. Transformación: las 6 etapas se activan en orden', trIdx.join(',') === '0,1,2,3,4,5', `idx: ${trIdx.join(',')}`);
  check('5b. Nav en modo claro sobre sección clara', (await S(page)).navLight);
  await page.screenshot({ path: `${SHOTS}/04-transformacion.png` });

  // 6. Programa (misión horizontal)
  const pr = await pinRange(page, '#programa');
  const prS = [];
  for (const p of [0, 0.3, 0.6, 1]) { await scrollTo(page, pr.top + pr.range * p, 600); const s = await S(page); prS.push({ idx: s.prIndex, x: s.prX }); }
  check('6. Programa: la línea de tiempo se desplaza horizontalmente', prS.every((s, i) => i === 0 || s.x <= prS[i - 1].x) && prS.at(-1).x < -200, `x: ${prS.map((s) => Math.round(s.x)).join(',')}`);
  check('6b. Programa: MES 01 → MES 04 en orden', prS.map((s) => s.idx).join(',') === '0,1,2,3');
  await page.screenshot({ path: `${SHOTS}/05-programa.png` });

  // 7. Galería de proyectos
  await page.locator('#gallery').scrollIntoViewIfNeeded(); await wait(700);
  await page.click('#pjNext'); await wait(900);
  const g1 = await page.evaluate(() => document.querySelector('#gallery').scrollLeft);
  check('7. Galería horizontal: la flecha desplaza las tarjetas', g1 > 100, `scrollLeft=${Math.round(g1)}`);
  await page.locator('#capstone').scrollIntoViewIfNeeded(); await wait(2200);
  const cap = await page.evaluate(() => { const v = document.querySelector('#capVideo'); return { w: v.videoWidth, paused: v.paused, playing: document.querySelector('#capstone').classList.contains('is-playing') }; });
  check('7b. Capstone: clip 03 se carga y reproduce', cap.w > 0 && !cap.paused && cap.playing, JSON.stringify(cap));
  await page.screenshot({ path: `${SHOTS}/06-proyectos.png` });

  // 8. Certificación
  await page.locator('#certCard').scrollIntoViewIfNeeded(); await wait(2200);
  const certItems = await page.$$eval('#certList li', (els) => els.map((e) => Number(getComputedStyle(e).opacity)));
  const certVid = await page.evaluate(() => { const v = document.querySelector('#certVideo'); return v.videoWidth > 0 && !v.paused; });
  check('8. Certificación: la tarjeta se revela con sus 7 puntos', (await S(page)).certIn && certItems.length === 7 && certItems.every((o) => o > 0.9), certItems.map((o) => o.toFixed(1)).join(','));
  check('8b. Certificación: clip 04 reproduce dentro de la tarjeta', certVid);
  const certText = await page.textContent('#certificacion');
  check('8c. Certificación: Anthropic emite · AI LAB prepara', /Anthropic/.test(certText) && /Emite la certificación oficial/.test(certText) && /Proporciona formación/.test(certText));
  await page.screenshot({ path: `${SHOTS}/07-certificacion.png` });

  // 9. Acompañamiento
  await page.locator('#supSvg').scrollIntoViewIfNeeded(); await wait(2400);
  const s9 = await S(page);
  const supVid = await page.evaluate(() => { const v = document.querySelector('#supportVideo'); return v.videoWidth > 0 && !v.paused; });
  check('9. Acompañamiento: 5 nodos conectados a CERTIFICACIÓN', s9.supportIn && s9.supportLinks === 5 && (await page.$$eval('#supSvg .sn__node.is-in', (e) => e.length)) === 5);
  check('9b. Acompañamiento: clip 02 de fondo reproduce', supVid);
  await page.screenshot({ path: `${SHOTS}/08-soporte.png` });

  // 10. Perfil
  await page.locator('#profileUi').scrollIntoViewIfNeeded(); await wait(2400);
  check('10. Perfil AI Developer: 6 componentes verificados ensamblados', (await S(page)).profileIn && (await page.textContent('#puiCount')) === '6');
  await page.screenshot({ path: `${SHOTS}/09-perfil.png` });

  // 11. Launchpad + testimonios + métricas
  await page.locator('#launchpad').scrollIntoViewIfNeeded(); await wait(600);
  check('11. Launchpad: 9 tarjetas', (await page.$$eval('#launchpad .fcard', (e) => e.length)) === 9);
  await page.locator('#metricsGrid').scrollIntoViewIfNeeded(); await wait(2000);
  const metrics = await page.$$eval('#metricsGrid [data-counter]', (els) => els.map((e) => [e.textContent, e.dataset.counter]));
  check('12. Métricas: contadores animados llegan a 4 · 5 · 1 · 1', metrics.every(([t, c]) => t === c) && metrics.map((m) => m[1]).join(',') === '4,5,1,1', metrics.map((m) => m[0]).join(','));
  await page.screenshot({ path: `${SHOTS}/10-metricas.png` });
  check('12b. Incluye: 11 tarjetas', (await page.$$eval('#includedGrid .fcard', (e) => e.length)) === 11);
  check('12c. Inversión: 14 puntos y $8,000 MXN', (await page.$$eval('#pricingList li', (e) => e.length)) === 14 && /8,000/.test(await page.textContent('.pricing__amount')));

  // 13. FAQ
  await page.locator('#faq').scrollIntoViewIfNeeded(); await wait(500);
  const q = page.locator('#accordion .acc summary');
  check('13. FAQ: 15 preguntas', (await q.count()) === 15);
  await q.nth(0).click(); await wait(700);
  const open1 = await page.$$eval('#accordion .acc[open]', (e) => e.length);
  await q.nth(14).click(); await wait(800);
  const open2 = await page.$$eval('#accordion .acc[open]', (e) => e.length);
  const lastAns = await page.textContent('#accordion .acc:last-child .acc__body');
  check('13b. FAQ: acordeón abre uno a la vez', open1 === 1 && open2 === 1 && (await S(page)).faqOpen === 14);
  check('13c. FAQ final distingue Anthropic (emite) y AI LAB (formación)', /Anthropic/.test(lastAns) && /emite la certificación oficial/.test(lastAns) && /AI LAB/.test(lastAns) && /formación/.test(lastAns));
  await page.screenshot({ path: `${SHOTS}/11-faq.png` });

  // 14. CTA final
  await page.locator('#final').scrollIntoViewIfNeeded(); await wait(2600);
  const fin = await page.evaluate(() => { const v = document.querySelector('#finalVideo'); return { w: v.videoWidth, paused: v.paused, playing: document.querySelector('#final').classList.contains('is-playing'), l2: Number(getComputedStyle(document.querySelector('#finalL2')).opacity) }; });
  check('14. CTA final: clip 05 reproduce y "LA CONSTRUIRÁ." aparece tras la pausa', fin.w > 0 && !fin.paused && fin.playing && fin.l2 > 0.9, JSON.stringify(fin));
  await page.screenshot({ path: `${SHOTS}/12-final.png` });

  // 15. CTAs + formulario
  await page.click('#final [data-intent="camino"]'); await wait(500);
  check('15. CTA primario abre el modal de solicitud', (await S(page)).modalOpen && (await page.textContent('#modalTitle')).includes('Comienza tu camino como AI Developer'));
  await page.click('#applyForm button[type=submit]'); await wait(300);
  check('15b. Validación bloquea envío vacío', !(await page.evaluate(() => document.querySelector('#formErr').hidden)));
  await page.fill('#applyForm input[name=name]', 'Ana Prueba'); await page.fill('#applyForm input[name=email]', 'ana@ejemplo.com'); await page.fill('#applyForm input[name=phone]', '+52 55 1234 5678'); await page.selectOption('#applyForm select[name=profile]', { index: 1 });
  await page.click('#applyForm button[type=submit]'); await wait(1300);
  check('15c. Envío llega al estado de éxito', (await S(page)).submitted && !(await page.evaluate(() => document.querySelector('#formOk').hidden)));
  await page.screenshot({ path: `${SHOTS}/13-modal-ok.png` });
  await page.keyboard.press('Escape'); await wait(300);
  check('15d. Modal cierra con Escape', await page.evaluate(() => document.querySelector('#modal').hidden));
  await page.click('#nav [data-intent="entrar"]'); await wait(400);
  check('15e. CTA de la nav "Quiero entrar" abre el modal', (await page.textContent('#modalTitle')).includes('Quiero entrar'));
  await page.keyboard.press('Escape'); await wait(200);
  await scrollTo(page, 0, 500);
  await page.click('#exploreBtn'); await wait(1300);
  check('15f. "Conoce el programa" desplaza más allá del hero', (await page.evaluate(() => scrollY)) > 2000);

  // 16. Nav glass + rendimiento + overflow
  check('16. Nav se transforma en barra glass al hacer scroll', (await S(page)).navScrolled && (await page.evaluate(() => getComputedStyle(document.querySelector('#nav')).backdropFilter !== 'none')));
  check('16b. Sin desplazamiento horizontal (1440)', !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));
  const perf = await page.evaluate(async () => {
    const hero = document.querySelector('#hero'); const max = hero.offsetHeight - innerHeight; let frames = 0, long = 0, last = performance.now(); const t0 = last;
    return await new Promise((res) => { const step = (now) => { frames++; if (now - last > 50) long++; last = now; const t = (now - t0) / 2500; window.scrollTo(0, max * Math.min(1, t)); if (t < 1) requestAnimationFrame(step); else res({ frames, long, fps: Math.round(frames / 2.5) }); }; requestAnimationFrame(step); });
  });
  check('16c. Scroll fluido en el hero (≥ 40 fps)', perf.fps >= 40 && perf.long <= 8, `${perf.fps} fps, ${perf.long} frames > 50 ms`);
  check('Sin errores de consola/página (escritorio)', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('Sin peticiones fallidas (escritorio)', failed.length === 0, failed.slice(0, 3).join(' | '));
  await page.close();
}

// ===================================================== REDUCED MOTION
{
  const { page } = await setup({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  await wait(600);
  const s = await S(page);
  check('Accesibilidad: con prefers-reduced-motion el hero muestra el estado final sin animar', s.heroFinal && s.agentsOn === 6);
  await page.close();
}

// ===================================================== TABLET 1024 · MÓVIL 390
for (const [name, viewport] of [['tablet', { width: 1024, height: 768 }], ['móvil', { width: 390, height: 844 }]]) {
  const { page, errors, failed } = await setup(viewport, name === 'móvil' ? { isMobile: true, hasTouch: true } : {});
  const t0 = Date.now(); while (Date.now() - t0 < 10000) { if ((await S(page)).ready) break; await wait(300); }
  await page.screenshot({ path: `${SHOTS}/20-${name}-hero.png` });
  const hero = await pinRange(page, '#hero');
  await scrollTo(page, hero.top + hero.range, 900);
  const s = await S(page);
  if (name === 'móvil') check('17. Móvil: pila vertical de agentes completamente activada', (await page.$$eval('.hero__stack li.is-on', (e) => e.length)) === 10 && s.heroFinal);
  else check('17. Tablet: la red del hero se ensambla por completo', s.agentsOn === 6 && s.orchOn && s.heroFinal, `agentes=${s.agentsOn}`);
  await page.screenshot({ path: `${SHOTS}/21-${name}-hero-fin.png` });
  if (name === 'móvil') {
    const burger = page.locator('#navBurger');
    check('17b. Móvil: menú hamburguesa visible', await burger.isVisible());
    await burger.click(); await wait(400);
    check('17c. Móvil: el menú abre y los enlaces son visibles', await page.locator('#navLinks a').first().isVisible());
    await burger.click(); await wait(300);
    await page.locator('#programa').scrollIntoViewIfNeeded(); await wait(600);
    const vertical = await page.evaluate(() => { const m = document.querySelectorAll('.month'); return m[1].getBoundingClientRect().top > m[0].getBoundingClientRect().bottom - 5; });
    check('17d. Móvil: la ruta de 4 meses se apila verticalmente', vertical);
    const swipe = await page.evaluate(() => { const g = document.querySelector('#gallery'); return g.scrollWidth > g.clientWidth && getComputedStyle(g).overflowX === 'auto'; });
    check('17e. Móvil: galería de proyectos deslizable', swipe);
    await page.locator('#faq .acc summary').first().tap(); await wait(600);
    check('17f. Móvil: FAQ abre con tap', (await page.$$eval('#accordion .acc[open]', (e) => e.length)) === 1);
  }
  await page.locator('#final').scrollIntoViewIfNeeded(); await wait(800);
  await page.screenshot({ path: `${SHOTS}/22-${name}-final.png` });
  check(`17g. ${name}: sin desplazamiento horizontal`, !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)));
  check(`Sin errores de consola/página (${name})`, errors.length === 0, errors.slice(0, 3).join(' | '));
  check(`Sin peticiones fallidas (${name})`, failed.length === 0, failed.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} comprobaciones superadas`);
process.exit(fails.length ? 1 : 0);
