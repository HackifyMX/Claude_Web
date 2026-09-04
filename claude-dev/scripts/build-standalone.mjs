// Genera un único HTML autocontenido (CSS, JS, fuentes, frames del hero, pósters y clips incrustados).
// Uso: node claude-dev/scripts/build-standalone.mjs  →  claude-dev/dist/ai-lab-claude-developer.html
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('claude-dev');
const read = (p) => fs.readFileSync(path.join(root, p));
const exists = (p) => fs.existsSync(path.join(root, p));
const data = (p, mime) => `data:${mime};base64,${read('assets/' + p).toString('base64')}`;
const mime = { ttf: 'font/ttf', woff2: 'font/woff2', jpg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' };

let html = read('index.html').toString();
let css = read('css/styles.css').toString();
const js = read('js/main.js').toString();

css = css.replace(/url\('\.\.\/assets\/([^']+)'\)/g, (m, p) => `url('${data(p, mime[p.split('.').pop()])}')`);
const framesDir = path.join(root, 'assets/hero/frames');
const frames = fs.existsSync(framesDir) ? fs.readdirSync(framesDir).filter((f) => f.endsWith('.webp')).sort().map((f) => data(`hero/frames/${f}`, 'image/webp')) : [];

html = html.replace(/<link rel="preload"[^>]*>\s*/g, '');
html = html.replace('<link rel="stylesheet" href="css/styles.css" />', () => `<style>\n${css}\n</style>`);
html = html.replace(/src="assets\/(hero\/poster\.jpg|video\/[^"]+\.jpg)"/g, (m, p) => (exists('assets/' + p) ? `src="${data(p, 'image/jpeg')}"` : m));
html = html.replace(/poster="assets\/(video\/[^"]+\.jpg)"/g, (m, p) => (exists('assets/' + p) ? `poster="${data(p, 'image/jpeg')}"` : m));
// El standalone conserva solo los MP4 H.264 (soporte universal) para contener el tamaño del archivo.
html = html.replace(/\s*<source data-src="assets\/video\/[^"]+\.webm" type="video\/webm" \/>/g, '');
html = html.replace(/<source data-src="assets\/(video\/[^"]+\.mp4)" type="video\/mp4" \/>/g, (m, p) => (exists('assets/' + p) ? `<source data-src="${data(p, 'video/mp4')}" type="video/mp4" />` : m));
html = html.replace('<script src="js/main.js" defer></script>', () => `<script>window.__AILCD_FRAMES=${JSON.stringify(frames)};</script>\n<script>\n${js}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/ai-lab-claude-developer.html');
fs.writeFileSync(out, html);
console.log(`${out}  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB  frames=${frames.length}`);
