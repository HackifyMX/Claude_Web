// Browser verification for the AI LAB ENTERPRISE landing.
// Usage: npx http-server -p 8081 -c-1 enterprise &  then  node enterprise/scripts/verify.mjs
// Env: BASE (default http://127.0.0.1:8081/), SHOTS (default enterprise/verify-shots), CHROME_PATH
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8081/';
const SHOTS = process.env.SHOTS || 'enterprise/verify-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function setup(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { const why = (r.failure() || {}).errorText || ''; if (r.resourceType() === 'media' && /ABORTED|RESET/.test(why)) return; failed.push(`${why} ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(1200);
  return { page, errors, failed };
}
const S = (page) => page.evaluate(() => ({ ...window.__aile }));
const scrollTo = async (page, y, ms = 650) => { await page.evaluate((y) => window.scrollTo(0, y), Math.round(y)); await wait(ms); };
const pinRange = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return { top: el.getBoundingClientRect().top + scrollY, range: el.offsetHeight - innerHeight }; }, sel);

// ===================================================== DESKTOP 1440
{
  const { page, errors, failed } = await setup({ width: 1440, height: 900 });
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) { const s = await S(page); if (s.framesLoaded >= s.frameCount) break; await wait(300); }
  const s0 = await S(page);
  // 1. Hero video (frame sequence) loads
  check('1. Hero frames loaded', s0.framesLoaded >= s0.frameCount * 0.95 && s0.ready, `${s0.framesLoaded}/${s0.frameCount}, ready=${s0.ready}`);
  const posterHidden = await page.evaluate(() => getComputedStyle(document.querySelector('#heroPoster')).opacity === '0');
  check('1b. Poster fades out once frames draw', posterHidden);
  check('Hero starts at frame 0', s0.heroFrame === 0, `frame ${s0.heroFrame}`);
  await page.screenshot({ path: `${SHOTS}/01-hero-top.png` });

  // 2 + 3. Hero assembly synced with scroll, agents activate progressively
  const hero = await pinRange(page, '#hero');
  const samples = [];
  for (const p of [0.05, 0.15, 0.25, 0.4, 0.5, 0.6, 0.72, 0.82, 0.95, 1]) {
    await scrollTo(page, hero.top + hero.range * p, 750);
    const s = await S(page);
    samples.push({ p, frame: s.heroFrame, agents: s.agentsOn, links: s.linksOn, orch: s.orchOn, final: s.heroFinal, stage: s.heroStage });
    await page.screenshot({ path: `${SHOTS}/02-hero-${String(Math.round(p * 100)).padStart(3, '0')}.png` });
  }
  const frames = samples.map((s) => s.frame), ag = samples.map((s) => s.agents);
  check('2. Hero frame index scrubs monotonically with scroll', frames.every((v, i) => i === 0 || v >= frames[i - 1]) && frames.at(-1) > frames[0], `frames: ${frames.join(',')}`);
  check('2b. Hero reaches final frame at end of pin', frames.at(-1) === s0.frameCount - 1, `${frames.at(-1)} of ${s0.frameCount - 1}`);
  check('3. Agents activate one by one', ag.every((v, i) => i === 0 || v >= ag[i - 1]) && new Set(ag).size >= 5 && ag.at(-1) === 6, `agents at samples: ${ag.join(',')}`);
  check('3b. Agent links draw after agents, before orchestrator', samples.find((s) => s.p === 0.5).links >= 1 && samples.find((s) => s.p === 0.72).links === 4, `links@50%=${samples.find((s) => s.p === 0.5).links}, @72%=${samples.find((s) => s.p === 0.72).links}`);
  check('3c. Orchestrator activates at stage 03', !samples.find((s) => s.p === 0.6).orch && samples.find((s) => s.p === 0.72).orch, samples.map((s) => `${s.p}:${s.orch ? 1 : 0}`).join(' '));
  check('3d. Final state: AI POWERED ENTERPRISE + HUD', samples.at(-1).final && samples.at(-1).stage === 'AI POWERED ENTERPRISE');
  await wait(1600);
  const hud = await page.$$eval('#heroHud [data-counter]', (els) => els.map((e) => [e.textContent, e.dataset.counter, e.dataset.done]));
  check('3e. HUD counters reach targets', hud.every(([t, c, d]) => Number(t) === Number(c) && d === '1'), hud.map((h) => h[0]).join(' · '));
  const copyOpacity = await page.evaluate(() => Number(getComputedStyle(document.querySelector('#heroCopy')).opacity));
  check('Hero copy hidden at end state', copyOpacity < 0.05, `opacity ${copyOpacity}`);
  await scrollTo(page, hero.top + hero.range * 0.3, 700);
  const back = await S(page);
  check('Hero scrubs backwards (agents deactivate)', back.agentsOn < 6 && back.heroFrame < frames.at(-1) && !back.orchOn, `agents=${back.agentsOn} frame=${back.heroFrame}`);

  // Credibility bar
  await page.locator('#featured').scrollIntoViewIfNeeded(); await wait(400);
  const marquee = await page.evaluate(() => getComputedStyle(document.querySelector('.marquee__track')).animationName);
  check('Credibility marquee moves', marquee === 'marquee', marquee);
  await page.screenshot({ path: `${SHOTS}/03-featured.png` });

  // Category
  await page.locator('#catSvg').scrollIntoViewIfNeeded(); await wait(1800);
  const catIn = await page.evaluate(() => document.querySelector('.category__diagram').classList.contains('is-in'));
  const navLight = await page.evaluate(() => document.querySelector('#nav').classList.contains('is-light'));
  check('Category diagram reveals; nav switches to light', catIn && navLight, `in=${catIn} navLight=${navLight}`);
  await page.screenshot({ path: `${SHOTS}/04-category.png` });

  // Layer 01
  await page.locator('#kgSvg').scrollIntoViewIfNeeded(); await scrollTo(page, (await page.evaluate(() => scrollY)) + 200, 1500);
  const kg = await S(page);
  check('Layer 01 knowledge graph fully connects', kg.kgNodesOn === 20, `nodes on: ${kg.kgNodesOn}`);
  await wait(2600);
  const kg2 = await S(page);
  check('Layer 01 agents query the graph', kg2.kgQueries >= 1 && (await page.textContent('#kgQuery')).includes('CORRELATIONS'), `queries=${kg2.kgQueries}`);
  await page.screenshot({ path: `${SHOTS}/05-layer01.png` });

  // Layer 02
  await page.locator('#intSvg').scrollIntoViewIfNeeded(); await scrollTo(page, (await page.evaluate(() => scrollY)) + 200, 1400);
  const it = await S(page);
  check('Layer 02 systems connect into orchestration layer', it.intConnected === 8 && (await page.textContent('#intFoot')).includes('automatic'), `connected=${it.intConnected}`);
  await page.screenshot({ path: `${SHOTS}/06-layer02.png` });

  // 5. Layer 03
  const ex = await pinRange(page, '#layer-03');
  const exS = [];
  for (const p of [0.05, 0.2, 0.35, 0.5, 0.62, 0.75, 0.86, 1]) { await scrollTo(page, ex.top + ex.range * p, 700); const s = await S(page); exS.push({ p, on: s.execAgentsOn, phase: s.execPhase, step: s.execStep }); if ([0.35, 0.62, 0.86, 1].includes(p)) await page.screenshot({ path: `${SHOTS}/07-layer03-${Math.round(p * 100)}.png` }); }
  const exOn = exS.map((s) => s.on);
  check('5. Layer 03 agents activate sequentially', exOn.every((v, i) => i === 0 || v >= exOn[i - 1]) && new Set(exOn).size >= 4 && exOn.at(-1) === 6, `online: ${exOn.join(',')}`);
  check('5b. Layer 03 phases: activate → communicate → execute → complete', exS.find((s) => s.p === 0.62).phase === 2 && exS.find((s) => s.p === 0.86).phase === 3 && exS.at(-1).phase === 4 && exS.at(-1).step === 6, exS.map((s) => `${s.p}:p${s.phase}/s${s.step}`).join(' '));
  const doneCards = await page.$$eval('.acard.is-done', (els) => els.length);
  check('5c. All six agents completed the shared workflow', doneCards === 6, `done=${doneCards}`);

  // 6. Layer 04
  await page.locator('#orchSvg').scrollIntoViewIfNeeded(); await wait(2500);
  const co = await S(page);
  const flowsOn = await page.$$eval('#orchFlows li.is-on', (els) => els.length);
  const hotNodes = await page.$$eval('.orch__node.is-hot', (els) => els.length);
  check('6. Layer 04 orchestrator runs multi-agent workflows', co.coordRunning && co.coordHops >= 2 && flowsOn >= 1 && hotNodes >= 1 && co.coordVerb, `running=${co.coordRunning} hops=${co.coordHops} flowsOn=${flowsOn} verb=${co.coordVerb}`);
  const orchVideo = await page.evaluate(() => { const v = document.querySelector('#coordVideo'); return { paused: v.paused, w: v.videoWidth, ready: v.readyState }; });
  check('6b. Clip 02 plays behind the coordination layer', !orchVideo.paused && orchVideo.w > 0, JSON.stringify(orchVideo));
  await page.screenshot({ path: `${SHOTS}/08-layer04.png` });

  // 7. Timeline
  const hw = await pinRange(page, '#how');
  const hs = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) { await scrollTo(page, hw.top + hw.range * p, 700); const s = await S(page); hs.push({ p, idx: s.howIndex, x: s.howX }); await page.screenshot({ path: `${SHOTS}/09-how-${Math.round(p * 100)}.png` }); }
  check('7. Four-step timeline translates horizontally with scroll', hs.every((s, i) => i === 0 || s.x <= hs[i - 1].x) && hs.at(-1).x < -400, `x: ${hs.map((s) => Math.round(s.x)).join(',')}`);
  check('7b. Timeline steps activate in order to AI POWERED ENTERPRISE', hs.map((s) => s.idx).join(',') === '0,1,2,3,4', `idx: ${hs.map((s) => s.idx).join(',')}`);

  // Stories
  await page.locator('#stories').scrollIntoViewIfNeeded(); await wait(900);
  await page.mouse.move(10, 10);
  const story = page.locator('.story').first();
  const beforeOpacity = await story.locator('.story__row').first().evaluate((el) => Number(getComputedStyle(el).opacity));
  await story.click(); await wait(900);
  const afterOpacity = await story.locator('.story__row').first().evaluate((el) => Number(getComputedStyle(el).opacity));
  check('Success-story cards reveal Before → Built → Result interactively', beforeOpacity < 0.6 && afterOpacity > 0.95 && (await story.evaluate((el) => el.classList.contains('is-open'))), `opacity ${beforeOpacity} → ${afterOpacity}`);
  await page.screenshot({ path: `${SHOTS}/10-proof.png` });

  // 12. Final CTA transitions into the cinematic enterprise environment
  await page.locator('#final').scrollIntoViewIfNeeded(); await wait(2500);
  const fin = await page.evaluate(() => { const v = document.querySelector('#finalVideo'); return { paused: v.paused, w: v.videoWidth, playing: document.querySelector('#final').classList.contains('is-playing'), opacity: getComputedStyle(v).opacity, log: document.querySelectorAll('#finalLog li').length }; });
  check('12. Final CTA: Clip 03 plays and fades in', !fin.paused && fin.w > 0 && fin.playing && Number(fin.opacity) > 0.5, JSON.stringify(fin));
  check('12b. Final HUD shows the workforce operating', fin.log >= 1);
  await page.screenshot({ path: `${SHOTS}/11-final.png` });

  // 8. CTAs
  await page.click('#final [data-intent="specialist"]'); await wait(500);
  const mTitle = await page.textContent('#modalTitle');
  check('8. Secondary CTA opens specialist modal', mTitle.trim() === 'Talk to a Specialist' && (await S(page)).modalOpen, mTitle.trim());
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('#final [data-intent="diagnostic"]'); await wait(500);
  check('8b. Primary CTA opens diagnostic modal', (await page.textContent('#modalTitle')).trim() === 'Get Your AI Diagnostic');
  await page.click('#diagForm button[type=submit]'); await wait(300);
  check('8c. Form validation blocks empty submit', !(await page.evaluate(() => document.querySelector('#formErr').hidden)));
  await page.fill('#diagForm input[name=name]', 'Ada Ops'); await page.fill('#diagForm input[name=email]', 'ada@example.com'); await page.fill('#diagForm input[name=company]', 'Example Co');
  await page.click('#diagForm button[type=submit]'); await wait(1200);
  check('8d. Form submits to success state', (await S(page)).submitted && !(await page.evaluate(() => document.querySelector('#formOk').hidden)));
  await page.screenshot({ path: `${SHOTS}/12-modal-success.png` });
  await page.keyboard.press('Escape'); await wait(300);
  check('8e. Modal closes', await page.evaluate(() => document.querySelector('#modal').hidden));
  await scrollTo(page, 0, 600);
  const exploreHref = await page.getAttribute('#exploreBtn', 'href');
  await page.click('#exploreBtn'); await wait(1200);
  const y = await page.evaluate(() => scrollY);
  check('8f. "Explore the System ↓" scrolls past the hero', exploreHref === '#featured' && y > 1000, `y=${Math.round(y)}`);

  // 10 + 11. Glitches / performance
  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check('10. No horizontal overflow at 1440', !hasHScroll);
  const perf = await page.evaluate(async () => {
    const hero = document.querySelector('#hero'); const max = hero.offsetHeight - innerHeight;
    let frames = 0, long = 0, last = performance.now(); const t0 = last;
    return await new Promise((res) => {
      const step = (now) => { frames++; if (now - last > 50) long++; last = now; const t = (now - t0) / 2500; window.scrollTo(0, max * Math.min(1, t)); if (t < 1) requestAnimationFrame(step); else res({ frames, long, fps: Math.round(frames / 2.5) }); };
      requestAnimationFrame(step);
    });
  });
  check('11. Smooth scroll through hero (≥ 40 fps, few long frames)', perf.fps >= 40 && perf.long <= 6, `${perf.fps} fps, ${perf.long} frames > 50 ms`);
  check('No console/page errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('No failed requests (desktop)', failed.length === 0, failed.slice(0, 3).join(' | '));
  await page.close();
}

// ===================================================== TABLET 1024 & MOBILE 390
for (const [name, viewport] of [['tablet', { width: 1024, height: 768 }], ['mobile', { width: 390, height: 844 }]]) {
  const { page, errors, failed } = await setup(viewport);
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) { const s = await S(page); if (s.ready) break; await wait(300); }
  await page.screenshot({ path: `${SHOTS}/20-${name}-hero.png` });
  const hero = await pinRange(page, '#hero');
  await scrollTo(page, hero.top + hero.range, 900);
  const s = await S(page);
  const stackOn = await page.$$eval('.hero__stack li.is-on', (els) => els.length);
  if (name === 'mobile') check('9. Mobile: vertical agent stack fully activated (AGENTS → ORCHESTRATION → EXECUTION → ENTERPRISE)', stackOn === 10 && s.heroFinal, `stack on=${stackOn}`);
  else check('9. Tablet: hero assembles fully', s.agentsOn === 6 && s.orchOn && s.heroFinal, `agents=${s.agentsOn}`);
  await page.screenshot({ path: `${SHOTS}/21-${name}-hero-end.png` });
  await page.locator('#layer-03').scrollIntoViewIfNeeded(); await wait(800);
  if (name === 'mobile') {
    await page.evaluate(() => document.querySelector('.acard:last-child').scrollIntoView({ block: 'center' })); await wait(900);
    const on = await page.$$eval('.acard.is-on', (els) => els.length);
    check('9b. Mobile: agent cards activate as they enter view', on >= 5, `on=${on}`);
  }
  await page.screenshot({ path: `${SHOTS}/22-${name}-layer03.png` });
  await page.locator('#how').scrollIntoViewIfNeeded(); await wait(700);
  await page.screenshot({ path: `${SHOTS}/23-${name}-how.png` });
  await page.locator('#final').scrollIntoViewIfNeeded(); await wait(900);
  await page.screenshot({ path: `${SHOTS}/24-${name}-final.png` });
  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`9c. ${name}: no horizontal overflow`, !hasHScroll);
  check(`No console/page errors (${name})`, errors.length === 0, errors.slice(0, 3).join(' | '));
  check(`No failed requests (${name})`, failed.length === 0, failed.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
