Timewarp shaders (GLSL ES 3.00 / WebGL2)

Each scene is built by concatenating:
  common.glsl  +  [lib files]  +  scene_<name>.glsl
and drawing a full-screen triangle. Libs per scene:
  mandala, ink, chalk  -> mandala_lib.glsl
  eclipse, tiles       -> eclipse_lib.glsl
  everything else      -> none

Scenes implement  vec3 render(vec2 p)  where p is centred, y in [-0.5, 0.5] for 16:9.

Uniforms (all floats unless noted)
  uRes (vec2)  output size in pixels
  uTime        song time, seconds
  uFlow        energy-integrated time: runs faster when the track is loud
  uSceneT      seconds since this scene started
  uSeed, uVar  per-segment random seed / variant, 0..1 (variants mirror or re-pose a scene)
  uReact       reactivity gain (1 = normal)
  uBass 20-150 Hz, uLowMid 150-500, uMid 500-2k, uHigh 2-6k, uTreble 6-16k, uLevel overall  (0..1, song-normalised)
  uKick, uSnare, uHat   onset envelopes, jump to hit strength then decay (0..1)
  uBeat, uBarPh         phase within the current beat / bar (0..1)
  uSpec (sampler2D, 64x1 R8)   log-spaced spectrum 30 Hz - 16 kHz
  uMath (sampler2D, R8, mipmapped, REPEAT)  chalk formula atlas, 8x4 cells

post.glsl  = transitions + hit FX (light bars, flare, zoom blur, RGB split, LED matrix, edge neon,
             invert, slice glitch, curved screen, smear, lightning, mirror echo)
bloom.glsl, final.glsl = two-level bloom and the tone/vignette/grain pass.
