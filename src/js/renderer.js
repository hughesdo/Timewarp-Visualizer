// ============================================================ WebGL2 renderer
const VS = `#version 300 es
in vec2 aPos; out vec2 vUV;
void main(){ vUV = aPos*0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const SCENE_UNIFORMS = ['uRes', 'uTime', 'uFlow', 'uSceneT', 'uSeed', 'uVar', 'uReact', 'uBass', 'uLowMid', 'uMid', 'uHigh', 'uTreble', 'uLevel', 'uKick', 'uSnare', 'uHat', 'uBeat', 'uBarPh', 'uSpec', 'uMath'];
const POST_UNIFORMS = ['uA', 'uB', 'uRes', 'uTime', 'uMix', 'uSeed', 'uTrans', 'uWipeAng', 'uZoom', 'uRGB', 'uFlash', 'uWash', 'uInvert', 'uLED', 'uEdge', 'uSlice', 'uCurve', 'uSmear', 'uBolt', 'uEcho', 'uBar', 'uBar2', 'uFlare'];
const BLOOM_UNIFORMS = ['uTex', 'uTexel', 'uDir', 'uMode', 'uThresh'];
const FINAL_UNIFORMS = ['uTex', 'uBloom1', 'uBloom2', 'uRes', 'uTime', 'uBloomAmt', 'uGrain', 'uVignette', 'uFade'];

class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('This browser has no WebGL2. Try a current Chrome, Edge, Firefox or Safari.');
    this.gl = gl; this.canvas = canvas;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vs = this._shader(gl.VERTEX_SHADER, VS);
    this.targets = {};
    this.size = [0, 0];
    // spectrum texture
    this.specTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(64));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.mathTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mathTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(1));
  }
  _shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }
  // compile every program; resolves when all are linked (parallel when the driver allows)
  async compileAll(defs, onProgress) {
    const gl = this.gl;
    const jobs = defs.map(d => {
      const fs = this._shader(gl.FRAGMENT_SHADER, d.src);
      const p = gl.createProgram();
      gl.attachShader(p, this.vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      return { d, p, fs };
    });
    const out = {};
    let done = 0;
    for (const j of jobs) {
      if (this.parallel) {
        while (!gl.getProgramParameter(j.p, this.parallel.COMPLETION_STATUS_KHR)) await new Promise(r => setTimeout(r, 16));
      }
      if (!gl.getProgramParameter(j.p, gl.LINK_STATUS)) {
        const log = gl.getShaderInfoLog(j.fs) || gl.getProgramInfoLog(j.p);
        throw new Error(`Shader "${j.d.name}" failed to compile:\n${log}`);
      }
      const loc = {};
      for (const u of j.d.uniforms) loc[u] = gl.getUniformLocation(j.p, u);
      out[j.d.name] = { p: j.p, loc };
      done++; onProgress && onProgress(done / jobs.length, j.d.name);
      await new Promise(r => setTimeout(r, 0));
    }
    this.progs = out;
  }
  setMathAtlas(canvas2d) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.mathTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, canvas2d);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }
  setSpectrum(bytes64) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, bytes64);
  }
  _target(name, w, h) {
    const gl = this.gl;
    let t = this.targets[name];
    if (t && t.w === w && t.h === h) return t;
    if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.hdr) {
      this.hdr = false; gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); delete this.targets[name];
      return this._target(name, w, h);
    }
    t = { tex, fbo, w, h };
    this.targets[name] = t;
    return t;
  }
  _bindTex(unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  _draw(target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  _scene(seg, st, target, w, h, react) {
    const gl = this.gl, sc = SCENES[seg.scene], P = this.progs[sc.id], L = P.loc, au = st.au;
    gl.useProgram(P.p);
    this._bindTex(0, this.specTex); this._bindTex(1, this.mathTex);
    gl.uniform1i(L.uSpec, 0); gl.uniform1i(L.uMath, 1);
    gl.uniform2f(L.uRes, w, h);
    gl.uniform1f(L.uTime, st.t + seg.seed * 100.0);
    gl.uniform1f(L.uFlow, au.flow + seg.seed * 50.0);
    gl.uniform1f(L.uSceneT, Math.max(0, st.t - seg.start));
    gl.uniform1f(L.uSeed, seg.seed); gl.uniform1f(L.uVar, seg.variant);
    gl.uniform1f(L.uReact, react);
    gl.uniform1f(L.uBass, au.bass); gl.uniform1f(L.uLowMid, au.lowmid); gl.uniform1f(L.uMid, au.mid);
    gl.uniform1f(L.uHigh, au.high); gl.uniform1f(L.uTreble, au.treble); gl.uniform1f(L.uLevel, au.level);
    gl.uniform1f(L.uKick, au.kick); gl.uniform1f(L.uSnare, au.snare); gl.uniform1f(L.uHat, au.hat);
    gl.uniform1f(L.uBeat, au.beat); gl.uniform1f(L.uBarPh, au.bar);
    this._draw(target, w, h);
  }
  render(st, W, H, opts) {
    const gl = this.gl;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    const tA = this._target('A', W, H), tB = this._target('B', W, H), tC = this._target('C', W, H);
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1), qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    const h1 = this._target('h1', hw, hh), h2 = this._target('h2', hw, hh), q1 = this._target('q1', qw, qh), q2 = this._target('q2', qw, qh);
    this._scene(st.a, st, tA, W, H, opts.react);
    if (st.b) this._scene(st.b, st, tB, W, H, opts.react);
    // composite
    const P = this.progs.post, L = P.loc, fx = st.fx;
    gl.useProgram(P.p);
    this._bindTex(0, tA.tex); this._bindTex(1, st.b ? tB.tex : tA.tex);
    gl.uniform1i(L.uA, 0); gl.uniform1i(L.uB, 1);
    gl.uniform2f(L.uRes, W, H); gl.uniform1f(L.uTime, st.t); gl.uniform1f(L.uMix, st.b ? st.mix : 0); gl.uniform1f(L.uSeed, st.a.seed);
    gl.uniform1i(L.uTrans, st.b ? st.trans : 0); gl.uniform1f(L.uWipeAng, st.wipeAng);
    const k = opts.fxMaster;
    gl.uniform1f(L.uZoom, fx.zoom * k); gl.uniform1f(L.uRGB, fx.rgb * k); gl.uniform1f(L.uFlash, fx.flash * k);
    gl.uniform1f(L.uWash, fx.wash * k); gl.uniform1f(L.uInvert, Math.min(1, fx.invert * k)); gl.uniform1f(L.uLED, Math.min(1, fx.led * Math.max(k, st.b ? 1 : 0)));
    gl.uniform1f(L.uEdge, Math.min(1, fx.edge * k)); gl.uniform1f(L.uSlice, Math.min(1, fx.slice * k)); gl.uniform1f(L.uCurve, Math.min(1, fx.curve));
    gl.uniform1f(L.uSmear, fx.smear); gl.uniform1f(L.uBolt, fx.bolt * k); gl.uniform1f(L.uEcho, fx.echo * k);
    gl.uniform4f(L.uBar, fx.bar[0] * (st.b && st.trans === 4 ? 1 : k), fx.bar[1], fx.bar[2], fx.bar[3]);
    gl.uniform4f(L.uBar2, fx.bar2[0] * k, fx.bar2[1], fx.bar2[2], fx.bar2[3]);
    gl.uniform4f(L.uFlare, Math.min(1.2, fx.flare[0] * Math.max(k, st.b ? 1 : 0)), fx.flare[1], fx.flare[2], fx.flare[3]);
    this._draw(tC, W, H);
    // bloom
    const B = this.progs.bloom, BL = B.loc;
    gl.useProgram(B.p); gl.uniform1i(BL.uTex, 0);
    const pass = (src, dst, mode, dir, thresh) => {
      this._bindTex(0, src.tex);
      gl.uniform2f(BL.uTexel, 1 / src.w, 1 / src.h); gl.uniform1i(BL.uMode, mode);
      gl.uniform2f(BL.uDir, dir[0], dir[1]); gl.uniform1f(BL.uThresh, thresh);
      this._draw(dst, dst.w, dst.h);
    };
    pass(tC, h1, 0, [0, 0], 0.55);
    pass(h1, h2, 1, [1, 0], 0); pass(h2, h1, 1, [0, 1], 0);
    pass(h1, q1, 0, [0, 0], 0.0);
    pass(q1, q2, 1, [1.5, 0], 0); pass(q2, q1, 1, [0, 1.5], 0);
    // final
    const F = this.progs.final, FL = F.loc;
    gl.useProgram(F.p);
    this._bindTex(0, tC.tex); this._bindTex(1, h1.tex); this._bindTex(2, q1.tex);
    gl.uniform1i(FL.uTex, 0); gl.uniform1i(FL.uBloom1, 1); gl.uniform1i(FL.uBloom2, 2);
    gl.uniform2f(FL.uRes, W, H); gl.uniform1f(FL.uTime, st.t);
    gl.uniform1f(FL.uBloomAmt, opts.bloom * (0.85 + 0.5 * st.au.bass * opts.react));
    gl.uniform1f(FL.uGrain, 0.025); gl.uniform1f(FL.uVignette, 0.55); gl.uniform1f(FL.uFade, opts.fade);
    this._draw(null, W, H);
  }
}
