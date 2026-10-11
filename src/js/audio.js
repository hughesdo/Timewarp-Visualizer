// ============================================================ playback, demo beat, export
class Player {
  constructor() { this.ctx = null; this.buffer = null; this.src = null; this.playing = false; this.offset = 0; this.startAt = 0; this.onEnded = null; this.recDest = null; }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  get duration() { return this.buffer ? this.buffer.duration : 0; }
  setBuffer(b) { this.stop(); this.buffer = b; this.offset = 0; }
  async play(from) {
    if (!this.buffer) return;
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume();
    this._kill();
    const t0 = Math.max(0, Math.min(this.duration - 0.01, from ?? this.offset));
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    src.onended = () => { if (this.src === src) { this.playing = false; this.offset = this.duration; this.src = null; this.onEnded && this.onEnded(); } };
    src.start(ctx.currentTime + 0.02, t0);
    this.startAt = ctx.currentTime + 0.02 - t0;
    this.src = src; this.playing = true;
  }
  _kill() { if (this.src) { const s = this.src; this.src = null; try { s.onended = null; s.stop(); } catch (e) {} } }
  pause() { if (!this.playing) return; this.offset = this.time(); this._kill(); this.playing = false; }
  stop() { this._kill(); this.playing = false; this.offset = 0; }
  seek(t) { t = Math.max(0, Math.min(this.duration, t)); if (this.playing) this.play(t); else this.offset = t; }
  // audible time; when recording use graph time so picture and captured audio line up
  time(graphTime) {
    if (!this.playing || !this.ctx) return this.offset;
    let ct = this.ctx.currentTime;
    if (!graphTime && this.ctx.getOutputTimestamp) {
      const ts = this.ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) ct = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return Math.max(0, Math.min(this.duration, ct - this.startAt));
  }
  recordStream() {
    const ctx = this.ensure();
    if (!this.recDest) { this.recDest = ctx.createMediaStreamDestination(); this.gain.connect(this.recDest); }
    return this.recDest.stream;
  }
}

// 124 BPM demo: intro, groove, drop, breakdown, final drop. Gives the analyser real sections to find.
async function synthDemo() {
  const sr = 44100, bpm = 124, beat = 60 / bpm, bars = 24;
  const dur = bars * 4 * beat + 2;
  const oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const comp = oc.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.12;
  const master = oc.createGain(); master.gain.value = 0.7;
  master.connect(comp); comp.connect(oc.destination);
  const nb = oc.createBuffer(1, sr, sr); const nd = nb.getChannelData(0);
  let s = 22; for (let i = 0; i < sr; i++) { s = (s * 16807) % 2147483647; nd[i] = s / 1073741823.5 - 1; }
  const noise = (t, len, filt, f, q, g, dec) => {
    const n = oc.createBufferSource(); n.buffer = nb;
    const fl = oc.createBiquadFilter(); fl.type = filt; fl.frequency.value = f; fl.Q.value = q;
    const a = oc.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    n.connect(fl); fl.connect(a); a.connect(master); n.start(t, Math.random() * 0.5); n.stop(t + len);
  };
  const kick = (t, g = 1) => {
    const o = oc.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const a = oc.createGain(); a.gain.setValueAtTime(1.1 * g, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(a); a.connect(master); o.start(t); o.stop(t + 0.45);
    noise(t, 0.02, 'highpass', 3000, 0.7, 0.25 * g, 0.015);
  };
  const snare = (t, g = 1) => {
    noise(t, 0.25, 'bandpass', 1900, 0.6, 0.75 * g, 0.2);
    const o = oc.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const a = oc.createGain(); a.gain.setValueAtTime(0.5 * g, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(a); a.connect(master); o.start(t); o.stop(t + 0.14);
  };
  const hat = (t, open, g = 1) => noise(t, open ? 0.3 : 0.06, 'highpass', 7500, 0.8, (open ? 0.22 : 0.16) * g, open ? 0.24 : 0.045);
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const synth = (t, len, note, type, cut, g, env = 0.01, det = 0) => {
    const o = oc.createOscillator(); o.type = type; o.frequency.value = midi(note); o.detune.value = det;
    const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut * 2.2, t); f.frequency.exponentialRampToValueAtTime(cut, t + Math.min(len, 0.25)); f.Q.value = 3;
    const a = oc.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + env); a.gain.setValueAtTime(g, t + len * 0.8); a.gain.exponentialRampToValueAtTime(0.0005, t + len);
    o.connect(f); f.connect(a); a.connect(master); o.start(t); o.stop(t + len + 0.02);
  };
  const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const roots = [33, 29, 36, 31];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = 0.05 + bar * 4 * beat;
    const sec = bar < 4 ? 'intro' : bar < 8 ? 'groove' : bar < 14 ? 'drop' : bar < 18 ? 'break' : 'drop2';
    const ch = chords[Math.floor(bar / 2) % 4], root = roots[Math.floor(bar / 2) % 4];
    // pad
    if (bar % 2 === 0) for (const n of ch) { synth(t0, 8 * beat, n, 'sawtooth', sec === 'break' ? 2200 : 900, 0.05, 0.6, -8); synth(t0, 8 * beat, n, 'sawtooth', 900, 0.04, 0.6, 9); }
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      const loud = sec === 'drop' || sec === 'drop2';
      if (sec !== 'intro' && sec !== 'break') kick(t, loud ? 1 : 0.85);
      if (loud && (b === 1 || b === 3)) snare(t);
      if (sec === 'groove' && b === 3 && bar % 2 === 1) snare(t, 0.6);
      hat(t + beat / 2, loud && b % 2 === 1, loud ? 1 : 0.6);
      if (sec !== 'intro') hat(t + beat * 0.75, false, 0.5);
      if (sec !== 'intro' && sec !== 'break') {
        synth(t + beat * 0.5, beat * 0.45, root + 12, 'sawtooth', loud ? 700 : 450, 0.32);
        if (loud) synth(t, beat * 0.3, root, 'square', 300, 0.22);
      }
      if (loud || sec === 'break') {
        for (let k = 0; k < 2; k++) synth(t + k * beat / 2, beat * 0.4, ch[(b * 2 + k) % 3] + 12 + (sec === 'drop2' ? 12 : 0), 'square', 2500, sec === 'break' ? 0.07 : 0.05, 0.005);
      }
    }
    if (bar === 13 || bar === 17) for (let k = 0; k < 8; k++) snare(t0 + 2 * beat + k * beat / 4, 0.4 + k * 0.07);
  }
  return await oc.startRendering();
}

function pickRecorderMime() {
  const c = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return null;
}

async function pickEncoderConfig(w, h, fps, bitrate) {
  if (typeof VideoEncoder === 'undefined' || typeof Mp4Muxer === 'undefined') return null;
  const px = w * h;
  const avc = px > 2228224 ? ['avc1.640033', 'avc1.640034'] : px > 983040 ? ['avc1.640028', 'avc1.64002a', 'avc1.4d0028'] : ['avc1.64001f', 'avc1.640028', 'avc1.42001f'];
  for (const codec of avc) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, muxCodec: 'avc' }; } catch (e) {}
  }
  for (const codec of ['vp09.00.40.08', 'vp09.00.10.08']) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality' };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, muxCodec: 'vp9' }; } catch (e) {}
  }
  return null;
}

async function pickAudioConfig(sr, ch) {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: 256000 };
    try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux }; } catch (e) {}
  }
  return null;
}
