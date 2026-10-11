// Inline shaders, muxer and app JS into one self-contained HTML file.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const shaderDir = path.join(root, 'shaders');
const shaders = {};
for (const f of fs.readdirSync(shaderDir).filter(f => f.endsWith('.glsl'))) {
  // strip // comments that are full-line and collapse blank lines (keeps line structure for error logs)
  shaders[f.replace('.glsl', '')] = fs.readFileSync(path.join(shaderDir, f), 'utf8');
}
const app = ['src/js/mathatlas.js', 'src/js/analysis.js', 'src/js/planner.js', 'src/js/renderer.js', 'src/js/audio.js', 'src/js/app.js'].map(rd).join('\n\n');
let muxer = fs.existsSync(path.join(root, 'vendor/mp4-muxer.min.js')) ? rd('vendor/mp4-muxer.min.js') : rd('vendor/package/build/mp4-muxer.js');
muxer = '/*! mp4-muxer 5.2.2 | MIT License | github.com/Vanilagy/mp4-muxer */\n' + muxer.replace('if (typeof module === "object" && typeof module.exports === "object") Object.assign(module.exports, Mp4Muxer)', '');
let html = rd('src/template.html');
html = html.replace('/*MUXER*/', () => muxer)
  .replace('/*SHADERS*/', () => 'const SHADERS = ' + JSON.stringify(shaders) + ';')
  .replace('/*APP*/', () => app);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/timewarp-artifact.html'), html);
// standalone version with a doctype for running from disk
const standalone = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${html}\n</body></html>\n`;
fs.writeFileSync(path.join(root, 'dist/timewarp-standalone.html'), standalone);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
