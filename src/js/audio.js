// ============================================================ playback, export
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

// Real-time recording: MP4 with H.264 + AAC where the browser can, otherwise WebM (which X won't take).
function pickRecorderMime() {
  const c = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return null;
}
// What a recorder MIME type means for posting.
function describeRecorderMime(mime) {
  const mp4 = /^video\/mp4/.test(mime);
  const video = /avc1/.test(mime) ? 'H.264' : /vp9/.test(mime) ? 'VP9' : /vp8/.test(mime) ? 'VP8' : null;
  const audio = /mp4a/.test(mime) ? 'AAC' : /opus/.test(mime) ? 'Opus' : null;
  return { container: mp4 ? 'mp4' : 'webm', video, audio, unknown: !video || !audio };
}
