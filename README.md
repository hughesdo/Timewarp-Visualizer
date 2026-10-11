# Timewarp Visualizer

**Turn any song into an audio-reactive shader music video.** Load a track, and the page analyzes it, cuts between 12 GLSL scenes on the beat, and exports an MP4 with your song as the soundtrack. Everything runs in one HTML file in your browser. Nothing is uploaded and nothing needs installing.

**[Open the live page](https://hughesdo.github.io/Timewarp-Visualizer/)** · [Download timewarp.html](timewarp.html) · [Read the full guide](docs/GUIDE.md)

![The Timewarp Visualizer page](docs/screenshot-ui.png)

The 12 scenes were rebuilt by Claude from a 30-second AI-generated music video. Claude broke the video into its distinct looks, wrote a shader for each, and built the song analysis, auto-editor and exporter around them, from a single prompt. The [guide](docs/GUIDE.md) tells the whole story, including the exact prompt, so you can do the same with your own video.

![Six of the twelve scenes](docs/scenes-grid.png)

## Credits

- **Teacher:** Don Hughes, [@OneHung on X](https://x.com/OneHung). Wrote the prompt, directed the build with Claude, and shares it here for free.
- **Student and inspiration:** [@StarlitBeRogue on X](https://x.com/StarlitBeRogue). Thank you for sharing your AI video, for asking all the right questions, and for caring enough to want to try this yourself. This repo exists because of that conversation.
- **Built with:** Claude by Anthropic.
- **MP4 writing:** [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) by Vanilagy (MIT), bundled into the page.

The source video is not included in this repo. It belongs to its creator.

## Quick start

1. Open the [live page](https://hughesdo.github.io/Timewarp-Visualizer/), or download `timewarp.html` and double-click it. Use Chrome or Edge.
2. Press Play to hear the built-in demo beat, or click **Load audio file** (MP3, WAV, M4A, AAC, OGG, FLAC, Opus) or drag a song onto the preview.
3. Adjust if you like: scene lengths, cut grid, transition style, hit effects, reactivity, output size.
4. Click **Render MP4 (frame-perfect)**, then **Save video**.

## What's inside

| Path | What it is | Do you need it? |
| --- | --- | --- |
| `timewarp.html` | The whole app in one file, about 185 KB. Shaders, analysis, editor and exporter are all inside it. | **Yes. This is the app.** |
| `index.html` | An identical copy, so GitHub Pages serves the app at the repo's address. | No |
| `docs/GUIDE.md` | The full guide: the starting prompt, every step Claude took, the scene breakdown, and how to do it with your own video. Written for beginners. | Recommended reading |
| `docs/AI-Video-to-Shader-Music-Video-Guide.docx` | The same guide as a Word file. | Optional |
| `shaders/` | The 18 GLSL source files, one per scene plus shared libraries and the effect passes, with a README of the inputs. | **No.** They're already built into `timewarp.html`. They're here for learning and remixing. |
| `src/`, `build.mjs`, `vendor/` | The page's JavaScript and HTML template, and the script that bundles everything into `timewarp.html`. | Only if you want to change the code |

## The 12 scenes

| # | Scene | What it looks like |
| --- | --- | --- |
| I | Chrono Mandala | Ornate Roman-numeral clock, 16 satellite clocks, holographic filament streak |
| II | Portal Falls | Black dome portal with neon pink and cyan waterfall curtains and a cyan splash |
| III | Clock Tunnel | Flying through a tunnel lined with clocks, warp-speed lines |
| IV | Equation Nebula | Blue nebula, chalk formulas writing themselves, a distant waterfall over a lake |
| V | Twin Lenses | Chrome lenses holding spinning galaxies, mirror-smear echoes |
| VI | Ink Negative | The mandala as black ink on white paper, with slice glitches |
| VII | Clock Vortex | Indigo spiral vortex with clocks spiraling inward and crystal shards |
| VIII | Starburst | Radial light rays from a cluster of small clocks |
| IX | Eclipse Ring | Glowing peach corona ring around a clock |
| X | Eclipse Tiles | Kaleidoscope columns of eclipse clocks |
| XI | Chalkboard Mandala | The mandala over a blackboard of formulas, with color split |
| XII | LED Spectrum | Dot-matrix LED screen with a live 48-bar spectrum analyzer |

Plus 8 transitions (flash, lens flare, zoom blur, light-bar wipe, LED pixel dissolve, glitch slices, curved-screen squeeze, vertical smear) and 12 hit effects that fire on kicks, snares and hi-hats.

## How it works

![How the page turns a song into a video](docs/how-it-works.png)

- **Listening:** the whole song is analyzed once, 100 times a second: five frequency bands, every kick, snare and hi-hat, the tempo, bar lines, and where the song changes section.
- **Editing:** section changes force a new scene with a big transition. Otherwise scenes change on bar lines after random lengths. Every scene appears before any repeats.
- **Drawing:** each frame runs the scene shaders with that instant's audio values, then transitions, hit effects and glow.
- **Saving:** frame-perfect export renders every frame offline with WebCodecs and writes an MP4. Real-time recording captures the screen and sound as the song plays.

Because the analysis is done up front, the preview and the export always match.

## Make one from your own AI video

The [guide](docs/GUIDE.md#doing-it-yourself-with-your-own-video) has two copy-and-paste prompts:

- **Path A:** give Claude your video and build everything from scratch, the way this one was made.
- **Path B:** give Claude your video plus `timewarp.html`, and ask it to swap in new scenes from your video while keeping the engine. Faster and safer.

## Changing the code

Edit files in `shaders/` or `src/`, then rebuild the single file:

```bash
node build.mjs
```

This writes `dist/timewarp-standalone.html`. Copy it over `timewarp.html` and `index.html`. No packages to install; Node 18 or newer is enough.

## Requirements and limits

- Chrome or Edge for frame-perfect MP4. Firefox and Safari can use real-time recording.
- A reasonably modern GPU. On older laptops, set Preview quality to Draft. Exports are never affected by preview stutter.
- Chrome and Edge on Windows and Mac write H.264 and AAC. Where those aren't available, the MP4 uses VP9 and Opus, which plays in VLC and browsers but not QuickTime.
- The handwritten chalk formulas use the Google font Caveat and fall back to a serif font offline.
- Tested end to end in a headless browser with software rendering, not yet on a wide range of real GPUs. Issues and reports are welcome.

## License

MIT. See [LICENSE](LICENSE).
