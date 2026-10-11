// Regenerates vendor/aac-wasm.js from the @mediabunny/aac-encoder npm package.
//
//   npm pack @mediabunny/aac-encoder@1.61.3 && tar xzf mediabunny-aac-encoder-1.61.3.tgz
//   node vendor/make-aac-wasm.mjs package/dist/modules/build/aac.js
//
// The package ships FFmpeg's AAC-LC encoder as an Emscripten module with the WASM
// inlined as a raw byte string. Raw bytes (including NUL) get mangled by an HTML
// parser inside a <script> tag, so this script re-encodes the WASM as base64,
// turns the ES module into a plain function (createAacWasmModule) that a classic
// <script> can define, and writes the result next to this file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const src = process.argv[2];
if (!src) { console.error('usage: node vendor/make-aac-wasm.mjs <path to aac.js>'); process.exit(1); }
let js = fs.readFileSync(src, 'utf8');

// 1. pull the inlined WASM out and decode it exactly the way the glue does
const open = "function findWasmBinary() { return binaryDecode('";
const a = js.indexOf(open);
const b = js.indexOf("'); }", a);
if (a < 0 || b < 0) throw new Error('could not find the inlined WASM in ' + src);
const literal = js.slice(a + open.length - 1, b + 1);              // keeps the quotes
const str = new Function('return ' + literal)();
const wasm = new Uint8Array(str.length);
for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); wasm[i] = ~c >> 8 & c; }
if (!WebAssembly.validate(wasm)) throw new Error('decoded WASM does not validate');
const sha = crypto.createHash('sha256').update(wasm).digest('hex');

// 2. swap the raw string for a base64 decode
js = js.slice(0, a) +
  'function findWasmBinary() { var s = atob(AAC_WASM_B64), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }' +
  js.slice(b + "'); }".length);

// 3. ES module -> plain function a classic script can define
const swaps = [
  ['"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n', ''],
  ['async function Module(moduleArg = {}) {', 'async function createAacWasmModule(moduleArg = {}) {'],
  ['var _scriptName = import.meta.url;', 'var _scriptName = (typeof location !== "undefined" ? location.href : "");'],
  ['\nexports.default = Module;', ''],
];
for (const [from, to] of swaps) {
  if (!js.includes(from)) throw new Error('expected text not found: ' + from.slice(0, 60));
  js = js.replace(from, () => to);
}
for (const bad of ['import.meta', 'exports.', 'require(']) {
  if (js.includes(bad)) throw new Error('leftover module syntax: ' + bad);
}

const b64 = Buffer.from(wasm).toString('base64');
const out = `/*! AAC-LC encoder: FFmpeg libavcodec (LGPL-2.1-or-later, https://ffmpeg.org) compiled to WASM,
 *  with the JS bridge from @mediabunny/aac-encoder 1.61.3 by Vanilagy (MPL-2.0,
 *  https://github.com/Vanilagy/mediabunny/tree/main/packages/aac-encoder).
 *  Source and build steps: see vendor/AAC-ENCODER.md. Only used when the browser
 *  has no AAC encoder of its own. WASM sha256: ${sha} */
const AAC_WASM_B64 = "${b64}";
${js.trim()}
`;
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), 'aac-wasm.js');
fs.writeFileSync(dest, out);
console.log(`wrote ${dest}: ${(out.length / 1024).toFixed(0)} KB (WASM ${(wasm.length / 1024).toFixed(0)} KB, sha256 ${sha})`);
