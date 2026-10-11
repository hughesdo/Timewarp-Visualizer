# Built-in AAC encoder

`aac-wasm.js` is an AAC-LC audio encoder that runs in the page as WebAssembly. Timewarp uses it only when the browser has no AAC encoder of its own (Chrome on Linux, Firefox, some Windows N editions). Chrome and Edge on Windows and Mac use their native encoder and never load it.

It makes sure every Render MP4 has AAC audio, which X requires. Without it, those browsers could only write Opus audio, which X refuses.

## What it is

- **Encoder:** FFmpeg's native AAC encoder from libavcodec, compiled to WebAssembly with Emscripten. License: LGPL-2.1-or-later. Source: <https://github.com/FFmpeg/FFmpeg>.
- **JS/C bridge and build:** from [`@mediabunny/aac-encoder`](https://www.npmjs.com/package/@mediabunny/aac-encoder) version 1.61.3 by Vanilagy. License: MPL-2.0. Source: <https://github.com/Vanilagy/mediabunny/tree/main/packages/aac-encoder>. The C bridge is copied here as `aac-encoder-src/bridge.c`.
- **WASM sha256:** `8488acb0bc9f43055b83600cc4c2c07d20f07675aa65671f91ac1d75515845d9` (also in the header of `aac-wasm.js`).
- **License texts:** `licenses/LGPL-2.1-ffmpeg.txt` and `licenses/MPL-2.0-mediabunny-aac-encoder.txt`.

The encoder sits in its own `<script>` block in `timewarp.html`, separate from the app code, so it can be swapped for a build of your own.

## How `aac-wasm.js` was made

The npm package inlines the WASM as a raw byte string. Raw bytes, including NUL characters, get mangled by the HTML parser inside a `<script>` tag, so `make-aac-wasm.mjs` re-encodes the WASM as base64 and turns the ES module into a plain function named `createAacWasmModule`. Nothing else in the code changes.

```bash
npm pack @mediabunny/aac-encoder@1.61.3
tar xzf mediabunny-aac-encoder-1.61.3.tgz
node vendor/make-aac-wasm.mjs package/dist/modules/build/aac.js
node build.mjs
```

## Building the WASM from source

The package README has the full Emscripten commands. In short, FFmpeg is configured with only the AAC encoder enabled:

```
emconfigure ./configure --target-os=none --arch=x86_32 --enable-cross-compile --disable-asm \
  --disable-x86asm --disable-inline-asm --disable-programs --disable-doc --disable-debug \
  --disable-all --disable-everything --disable-autodetect --disable-pthreads \
  --disable-runtime-cpudetect --enable-avcodec --enable-encoder=aac \
  --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib \
  --extra-cflags="-DNDEBUG -Oz -flto -msimd128" --extra-ldflags="-Oz -flto"
emmake make
```

`bridge.c` is then compiled against `libavcodec.a` and `libavutil.a` with `-s MODULARIZE=1 -s EXPORT_ES6=1 -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s MALLOC=emmalloc -msimd128 -flto -Oz`.

## How Timewarp uses it

`src/js/codecs.js` loads it on demand (`loadAacWasm`) and calls the bridge functions directly. It doesn't use the rest of Mediabunny. It encodes 1024-sample frames of interleaved float audio at 44.1 or 48 kHz, 128 kbps mono or 192 kbps stereo, and passes the packets and the AudioSpecificConfig to mp4-muxer. A 4-minute stereo song encodes in about 6 seconds.
