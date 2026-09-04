// Builds a single self-contained HTML (CSS, JS, fonts, hero frames, posters and clips inlined).
// Usage: node enterprise/scripts/build-standalone.mjs  →  enterprise/dist/ai-lab-enterprise.html
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('enterprise');
const read = (p) => fs.readFileSync(path.join(root, p));
const data = (p, mime) => `data:${mime};base64,${read('assets/' + p).toString('base64')}`;
const mime = { ttf: 'font/ttf', jpg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' };

let html = read('index.html').toString();
let css = read('css/styles.css').toString();
let js = read('js/main.js').toString();

css = css.replace(/url\('\.\.\/assets\/([^']+)'\)/g, (m, p) => `url('${data(p, mime[p.split('.').pop()])}')`);
const frames = fs.readdirSync(path.join(root, 'assets/hero/frames')).filter((f) => f.endsWith('.webp')).sort().map((f) => data(`hero/frames/${f}`, 'image/webp'));

html = html.replace(/<link rel="preload"[^>]*>\s*/g, '');
html = html.replace('<link rel="stylesheet" href="css/styles.css" />', () => `<style>\n${css}\n</style>`);
html = html.replace(/src="assets\/(hero\/poster\.jpg|video\/[^"]+\.jpg)"/g, (m, p) => `src="${data(p, 'image/jpeg')}"`);
html = html.replace(/poster="assets\/(video\/[^"]+\.jpg)"/g, (m, p) => `poster="${data(p, 'image/jpeg')}"`);
// Standalone keeps only the H.264 MP4 sources (universal browser support) to hold the file size down.
html = html.replace(/\s*<source src="assets\/video\/[^"]+\.webm" type="video\/webm" \/>/g, '');
html = html.replace(/<source src="assets\/(video\/[^"]+\.mp4)" type="video\/mp4" \/>/g, (m, p) => `<source src="${data(p, 'video/mp4')}" type="video/mp4" />`);
html = html.replace('<script src="js/main.js" defer></script>', () => `<script>window.__AILE_FRAMES=${JSON.stringify(frames)};</script>\n<script>\n${js}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/ai-lab-enterprise.html');
fs.writeFileSync(out, html);
console.log(`${out}  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB  frames=${frames.length}`);
