// Renders docs/propuesta-de-valor.html to PDF with Chromium (Playwright).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('file://' + path.join(here, 'propuesta-de-valor.html'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const out = path.join(here, 'Propuesta-de-Valor-Certificacion-Claude-Code.pdf');
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log('PDF:', out);
