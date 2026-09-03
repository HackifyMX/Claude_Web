// Usage: npx http-server -p 8080 -c-1 . &  then  node scripts/verify.mjs
// Requires: npm i -D playwright (and a Chromium; set CHROME_PATH to use a specific binary). Screenshots go to SHOTS (default ./verify-shots).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const SHOTS = process.env.SHOTS || 'verify-shots';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

import fs from 'node:fs';
import path from 'node:path';
const FONTS = path.resolve(process.env.FONTS_DIR || 'verify-fonts');
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
// Optional: if a local fonts dir exists (fonts.css + woff2 files), serve Google Fonts from it for offline runs.
async function fontRoutes(pg) {
  if (!fs.existsSync(path.join(FONTS, 'fonts.css'))) return;
  await pg.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'fonts.css')) }));
  await pg.route('https://fonts.gstatic.com/**', (r) => { const f = path.join(FONTS, path.basename(new URL(r.request().url()).pathname)); fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }) : r.abort(); });
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fontRoutes(page);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' @ ' + (m.location().url || '')); });
const failed = [];
const mediaAborts = [];
page.on('requestfailed', (r) => { const why = (r.failure() || {}).errorText || ''; const media = r.resourceType() === 'media'; if (media && (why === 'net::ERR_ABORTED' || why === 'net::ERR_CONNECTION_RESET')) { mediaAborts.push(`${why} ${r.url()}`); return; } failed.push(`${why} ${r.url()}`); });
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// --- Hero scrub
const st0 = await page.evaluate(() => ({ ...window.__ailab }));
check('Hero frames loaded', st0.framesLoaded >= st0.frameCount * 0.9, `${st0.framesLoaded}/${st0.frameCount}`);
check('Hero starts at frame 0', st0.heroFrame === 0, `frame ${st0.heroFrame}`);
await page.screenshot({ path: `${SHOTS}/01-hero-top.png` });

const heroH = await page.evaluate(() => document.querySelector('#hero').offsetHeight - innerHeight);
const samples = [];
for (const p of [0.25, 0.5, 0.75, 1]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(heroH * p));
  await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({ ...window.__ailab }));
  samples.push(s.heroFrame);
  await page.screenshot({ path: `${SHOTS}/02-hero-${Math.round(p * 100)}.png` });
}
check('Hero frame advances monotonically with scroll', samples.every((v, i) => i === 0 || v >= samples[i - 1]) && samples[3] > samples[0], `frames at 25/50/75/100%: ${samples.join(', ')}`);
check('Hero reaches final frame', samples[3] === st0.frameCount - 1, `${samples[3]} of ${st0.frameCount - 1}`);
const fade = await page.evaluate(() => getComputedStyle(document.querySelector('#heroFade')).opacity);
check('Hero fades to white at end', Number(fade) > 0.95, `opacity ${fade}`);
await page.evaluate(() => window.scrollTo(0, Math.round((document.querySelector('#hero').offsetHeight - innerHeight) * 0.5)));
await page.waitForTimeout(600);
const back = await page.evaluate(() => window.__ailab.heroFrame);
check('Hero scrubs backwards', back < samples[3] && back > 0, `frame ${back}`);
const navLight = await page.evaluate(() => document.querySelector('#nav').classList.contains('is-light'));
check('Nav stays dark over hero', !navLight);

// --- Poder pinned panels
const poderTop = await page.evaluate(() => document.querySelector('#poder').offsetTop);
const poderRange = await page.evaluate(() => document.querySelector('#poder').offsetHeight - innerHeight);
const idx = [];
for (const p of [0.1, 0.5, 0.9]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(poderTop + poderRange * p));
  await page.waitForTimeout(900);
  idx.push(await page.evaluate(() => window.__ailab.poderIndex));
  await page.screenshot({ path: `${SHOTS}/03-poder-${Math.round(p * 100)}.png` });
}
check('Three pinned panels switch with scroll', idx.join(',') === '0,1,2', `indices ${idx.join(',')}`);
const activeTitle = await page.textContent('.poder__panel.is-active .poder__title');
check('Third panel is Certifícate', activeTitle.trim() === 'Certifícate', activeTitle.trim());
const poderPlaying = await page.evaluate(() => { const v = document.querySelector('#poderVideo'); return { paused: v.paused, ready: v.readyState, w: v.videoWidth }; });
check('Clip 2 video playing', !poderPlaying.paused && poderPlaying.w > 0, JSON.stringify(poderPlaying));

// --- Counters
await page.locator('#metrics').scrollIntoViewIfNeeded();
await page.waitForTimeout(2600);
const counters = await page.$$eval('.counter', (els) => els.map((e) => [e.textContent, e.dataset.count, e.dataset.done]));
check('Metric counters animate to targets', counters.every(([t, c, d]) => t === c && d === '1'), counters.map((c) => c[0]).join(' · '));
await page.screenshot({ path: `${SHOTS}/04-metrics.png` });

// --- Timeline
await page.locator('#timeline').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 600));
await page.waitForTimeout(800);
const tlH = await page.evaluate(() => parseFloat(document.querySelector('#timelineProgress').style.height));
check('Timeline progress line draws on scroll', tlH > 10, `${tlH}%`);
await page.screenshot({ path: `${SHOTS}/05-timeline.png` });

// --- Transformation
await page.locator('#journey').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 300));
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/06-transform.png` });
await page.locator('#beneficios .section__head').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollBy(0, 200));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/07-benefits.png` });
const glassIn = await page.$$eval('.glass', (els) => els.filter((e) => e.classList.contains('is-in')).length);
check('Benefit cards reveal', glassIn === 8, `${glassIn}/8`);

// --- Testimonials
await page.locator('#testimonios').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 300));
await page.waitForTimeout(1300);
const testi = await page.$$eval('.testi', (els) => els.map((e) => ({ in: e.classList.contains('is-in'), name: e.querySelector('strong').textContent, img: (() => { const i = e.querySelector('img'); return i.complete && i.naturalWidth > 0; })() })));
check('Testimonial cards reveal with images', testi.every((t) => t.in && t.img) && testi.length === 4, testi.map((t) => `${t.name}${t.img ? '' : ' (no img)'}`).join(' · '));
await page.hover('.testi >> nth=0');
await page.waitForTimeout(400);
const spot = await page.$eval('.testi', (e) => e.style.getPropertyValue('--mx'));
check('Testimonial spotlight tracks pointer', spot !== '', `--mx=${spot}`);
await page.screenshot({ path: `${SHOTS}/08-testimonials.png` });

// --- Pricing
await page.locator('#inversion').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
const price = await page.textContent('#priceNumber');
check('Pricing shows $8,000 MXN', price.trim() === '8,000', price.trim());
await page.screenshot({ path: `${SHOTS}/09-pricing.png` });

// --- FAQ accordion
await page.locator('#faq').scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
const trig = page.locator('.acc__trigger');
await trig.nth(0).click();
await page.waitForTimeout(700);
let open = await page.$$eval('.acc__trigger', (els) => els.map((e) => e.getAttribute('aria-expanded')));
const h1 = await page.$eval('#faq-1 .acc__body', (e) => e.getBoundingClientRect().height);
check('FAQ opens first item', open[0] === 'true' && h1 > 20, `height ${Math.round(h1)}px`);
await trig.nth(3).click();
await page.waitForTimeout(700);
open = await page.$$eval('.acc__trigger', (els) => els.map((e) => e.getAttribute('aria-expanded')));
check('FAQ single-open: item 4 open, item 1 closed', open[0] === 'false' && open[3] === 'true', open.join(','));
await page.screenshot({ path: `${SHOTS}/10-faq.png` });
await trig.nth(3).click();
await page.waitForTimeout(700);
open = await page.$$eval('.acc__trigger', (els) => els.map((e) => e.getAttribute('aria-expanded')));
check('FAQ toggles closed', open.every((v) => v === 'false'));
await trig.nth(0).focus();
await page.keyboard.press('ArrowDown');
const focused = await page.evaluate(() => document.activeElement.id);
check('FAQ keyboard arrow navigation', focused === 'faq-2-btn', focused);

// --- Final CTA + modal
await page.locator('#final').scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const finalPlaying = await page.evaluate(() => { const v = document.querySelector('#finalVideo'); return { paused: v.paused, w: v.videoWidth }; });
check('Clip 3 video playing behind final CTA', !finalPlaying.paused && finalPlaying.w > 0, JSON.stringify(finalPlaying));
await page.screenshot({ path: `${SHOTS}/11-final.png` });
await page.click('#finalCta');
await page.waitForTimeout(600);
const modalOpen = await page.evaluate(() => !document.querySelector('#ctaModal').hidden && document.querySelector('#ctaModal').classList.contains('is-open'));
check('Primary CTA opens modal', modalOpen);
const focusedField = await page.evaluate(() => document.activeElement.id);
check('Modal focuses name field', focusedField === 'fNombre', focusedField);
await page.click('#formSubmit');
await page.waitForTimeout(300);
const errShown = await page.evaluate(() => !document.querySelector('#formError').hidden);
check('Form validates empty submit', errShown);
await page.fill('#fNombre', 'Valeria Ruiz');
await page.fill('#fEmail', 'valeria@example.com');
await page.click('#formSubmit');
await page.waitForTimeout(1200);
const success = await page.evaluate(() => !document.querySelector('#modalSuccess').hidden && document.querySelector('#successName').textContent);
check('Form submit shows success state', success === 'Valeria', String(success));
await page.screenshot({ path: `${SHOTS}/12-modal-success.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const closed = await page.evaluate(() => document.querySelector('#ctaModal').hidden);
check('Escape closes modal', closed);

// hero CTA + nav CTA
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.click('#heroCta');
await page.waitForTimeout(500);
check('Hero CTA opens modal', await page.evaluate(() => !document.querySelector('#ctaModal').hidden));
await page.click('[data-modal-close].modal__close');
await page.waitForTimeout(500);
await page.click('.nav .btn');
await page.waitForTimeout(500);
check('Nav CTA opens modal', await page.evaluate(() => !document.querySelector('#ctaModal').hidden));
await page.keyboard.press('Escape');

// mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await fontRoutes(m);
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(1200);
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check('No horizontal overflow on mobile', !overflow);
await m.screenshot({ path: `${SHOTS}/13-mobile-hero.png` });
await m.evaluate(() => document.querySelector('#beneficios').scrollIntoView());
await m.waitForTimeout(1200);
await m.screenshot({ path: `${SHOTS}/14-mobile-benefits.png` });

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('No failed/404 requests', failed.length === 0, failed.slice(0, 5).join(' | '));
if (mediaAborts.length) console.log(`note: ${mediaAborts.length} media requests cancelled by the browser (range fetch aborts / unsupported codec in this Chromium): ` + mediaAborts.join(' | '));
await browser.close();
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
