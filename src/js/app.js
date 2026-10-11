// ============================================================ app
const $ = (s) => document.querySelector(s);
const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const RES = {
  '1280x720': [1280, 720], '1920x1080': [1920, 1080], '2560x1440': [2560, 1440], '3840x2160': [3840, 2160],
  '1080x1920': [1080, 1920], '1080x1080': [1080, 1080], '1080x1350': [1080, 1350],
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('timewarp.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('timewarp.' + k, JSON.stringify(v)); } catch (e) {} },
};

const S = {
  A: null, plan: null, name: '',
  cfg: Object.assign({ enabled: SCENES.map((_, i) => i), minSeg: 4, maxSeg: 10, cutOn: 'bar', transStyle: 'mixed', fx: 0.6, react: 1.0, seed: 1, followSections: true, energyMatch: true }, store.get('cfg', {})),
  out: Object.assign({ res: '1920x1080', fps: 60, mbps: 16, preview: 0.5 }, store.get('out', {})),
  solo: null, recording: false, exporting: false, cancel: false, dirty: true, ready: false,
  lastBlob: null, canRender: typeof VideoEncoder !== 'undefined',
};
S.cfg.enabled = S.cfg.enabled.filter(i => i >= 0 && i < SCENES.length);
if (!S.cfg.enabled.length) S.cfg.enabled = SCENES.map((_, i) => i);

const player = new Player();
let R = null;
const dlCap = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);

function status(msg, kind) {
  const el = $('#status');
  el.textContent = msg || '';
  el.dataset.kind = kind || '';
}
function progress(p) {
  const el = $('#busyBar');
  el.hidden = p == null;
  if (p != null) el.style.setProperty('--p', Math.round(p * 100) + '%');
}

// ------------------------------------------------------------ shaders
function buildProgramDefs() {
  const defs = SCENES.map(sc => ({
    name: sc.id, uniforms: SCENE_UNIFORMS,
    src: SHADERS.common + '\n' + sc.libs.map(l => SHADERS[l]).join('\n') + '\n' + SHADERS['scene_' + sc.id],
  }));
  defs.push({ name: 'post', uniforms: POST_UNIFORMS, src: SHADERS.post });
  defs.push({ name: 'bloom', uniforms: BLOOM_UNIFORMS, src: SHADERS.bloom });
  defs.push({ name: 'final', uniforms: FINAL_UNIFORMS, src: SHADERS.final });
  return defs;
}

// ------------------------------------------------------------ planning
function replan() {
  if (!S.A) return;
  S.plan = planTimeline(S.A, S.cfg);
  store.set('cfg', S.cfg);
  renderSceneList();
  drawTimeline();
  const used = S.plan.counts.filter(c => c > 0).length;
  $('#planStats').textContent = `${S.plan.segs.length} cuts planned · ${used} of ${S.cfg.enabled.length} scenes used · ${S.A.sections.length} section changes`;
  S.dirty = true;
}

// ------------------------------------------------------------ track loading
async function useBuffer(buf, name) {
  status('Analyzing the track…');
  progress(0);
  const analysis = await analyzeAudio(buf, p => progress(p));   // swap song and analysis together, never half
  progress(null);
  player.setBuffer(buf);
  S.A = analysis; S.name = name;
  $('#trackName').textContent = name;
  const A = S.A;
  $('#trackStats').innerHTML = '';
  const stats = [
    ['Length', fmt(A.duration)], ['Tempo', `${A.bpm.toFixed(1)} BPM`], ['Sections', String(A.sections.length + 1)],
    ['Kicks', String(A.onsets.kick.length)], ['Snares', String(A.onsets.snare.length)], ['Hats', String(A.onsets.hat.length)],
  ];
  for (const [k, v] of stats) {
    const d = document.createElement('div');
    d.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
    $('#trackStats').appendChild(d);
  }
  $('#bpm').textContent = `${A.bpm.toFixed(0)} BPM`;
  replan();
  updateEstimate();
  status(`Loaded “${name}”. Press play to preview.`);
  setOverlay(name, 'Press play to preview. Render when you like what you see.', 'Load a different song', true);
  for (const id of ['#playBtn', '#recBtn']) $(id).disabled = false;
  $('#renderBtn').disabled = !(S.canRender && S.A);
  updateTransport();
}

async function loadFile(file) {
  if (!file) return;
  if (S.recording || S.exporting) return;
  try {
    player.stop(); updateTransport();
    for (const id of ['#playBtn', '#recBtn', '#renderBtn']) $(id).disabled = true;
    status(`Decoding “${file.name}”…`);
    progress(0.02);
    const ab = await file.arrayBuffer();
    const ctx = player.ensure();
    const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    await useBuffer(buf, file.name.replace(/\.[^.]+$/, ''));
  } catch (e) {
    progress(null);
    if (S.A) { for (const id of ['#playBtn', '#recBtn']) $(id).disabled = false; $('#renderBtn').disabled = !S.canRender; }
    status(`Couldn’t read that file. Try an MP3, WAV, M4A, OGG or FLAC.`, 'error');
    console.error(e);
  }
}

// The stage overlay: before a song is loaded it asks for one; afterwards it shows the song and a play button.
function setOverlay(title, text, buttonLabel, canPlay) {
  $('#overlayTitle').textContent = title;
  $('#overlayText').textContent = text;
  $('#overlayFile').textContent = buttonLabel;
  $('#overlayFile').classList.toggle('primary', !canPlay);
  $('#overlayFile').hidden = false;
  $('#bigPlay').hidden = !canPlay;
  $('#overlay').hidden = false;
}

// ------------------------------------------------------------ render loop
function outSize() { return RES[S.out.res] || RES['1920x1080']; }
function renderAt(t, W, H, fade) {
  const st = frameState(S.A, S.plan, t, S.cfg, W / H, S.solo);
  const f = st.au.frame;
  R.setSpectrum(S.A.specBytes.subarray(f * 64, f * 64 + 64));
  R.render(st, W, H, { react: S.cfg.react, fxMaster: Math.min(1.5, S.cfg.fx * 1.6), bloom: 0.9, fade: fade ?? 1 });
  return st;
}
let lastHud = '';
function frame() {
  requestAnimationFrame(frame);
  if (!S.ready || !S.A || S.exporting) return;
  const t = player.time(S.recording);
  if (!player.playing && !S.dirty) return;
  S.dirty = false;
  const [w, h] = outSize();
  const sc = S.recording ? 1 : S.out.preview;
  const W = Math.max(2, Math.round(w * sc / 2) * 2), H = Math.max(2, Math.round(h * sc / 2) * 2);
  const st = renderAt(t, W, H);
  // HUD + meters
  const seg = st.b && st.mix > 0.5 ? st.b : st.a;
  const hud = `${ROMAN[seg.scene]} · ${SCENES[seg.scene].name}${S.solo != null ? ' (preview)' : ''}`;
  if (hud !== lastHud) { $('#hud').textContent = hud; lastHud = hud; highlightScene(seg.scene); }
  const au = st.au;
  const m = [au.bass, au.lowmid, au.mid, au.high, au.treble, au.kick, au.snare, au.hat];
  meterEls.forEach((el, i) => el.style.setProperty('--v', Math.min(1, m[i]).toFixed(3)));
  $('#clock').textContent = `${fmt(t)} / ${fmt(S.A.duration)}`;
  drawTimeline(t);
}

// ------------------------------------------------------------ transport
function updateTransport() {
  $('#playBtn').textContent = player.playing ? 'Pause' : 'Play';
  $('#playBtn').setAttribute('aria-pressed', player.playing ? 'true' : 'false');
  $('#overlay').hidden = player.playing || S.recording || S.exporting;
}
async function togglePlay() {
  if (!S.A || S.exporting) return;
  if (S.recording) return;
  if (player.playing) player.pause();
  else { if (player.offset >= player.duration - 0.05) player.offset = 0; await player.play(); }
  updateTransport();
  S.dirty = true;
}
player.onEnded = () => { updateTransport(); S.dirty = true; };

// ------------------------------------------------------------ timeline
const tl = { el: null, ctx: null, drag: false, hoverX: -1 };
function drawTimeline(t) {
  const c = tl.el; if (!c || !S.plan) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = tl.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const D = S.A.duration, X = (s) => s / D * w;
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue('--line').trim(), muted = css.getPropertyValue('--muted').trim(), brass = css.getPropertyValue('--brass').trim(), text = css.getPropertyValue('--text').trim();
  const top = 14, bh = h - top - 12;
  // level envelope
  g.fillStyle = line;
  const step = Math.max(1, Math.floor(S.A.n / w));
  for (let x = 0; x < w; x++) {
    const i = Math.floor(x / w * S.A.n);
    let v = 0; for (let k = i; k < Math.min(S.A.n, i + step); k++) v = Math.max(v, S.A.level[k]);
    const hh = v * 10;
    g.fillRect(x, h - hh, 1, hh);
  }
  // segments
  g.font = '600 11px "Cinzel", Georgia, serif';
  g.textBaseline = 'middle';
  for (const s of S.plan.segs) {
    const x0 = X(s.start), x1 = X(s.end), sc = SCENES[s.scene];
    g.globalAlpha = S.solo != null && S.solo !== s.scene ? 0.25 : 0.85;
    g.fillStyle = sc.color;
    g.fillRect(x0 + 0.5, top, Math.max(1, x1 - x0 - 1), bh);
    g.globalAlpha = 1;
    if (x1 - x0 > 22) { g.fillStyle = '#0c0a12'; g.fillText(ROMAN[s.scene], x0 + 5, top + bh / 2); }
  }
  // transitions
  for (const tr of S.plan.trans) {
    const x = X(tr.t);
    g.fillStyle = tr.big ? brass : text;
    g.beginPath(); g.moveTo(x, top - 2); g.lineTo(x - 4, top - 8); g.lineTo(x + 4, top - 8); g.closePath(); g.fill();
  }
  // section changes
  g.strokeStyle = brass; g.lineWidth = 2;
  for (const s of S.A.sections) { const x = X(s.t); g.beginPath(); g.moveTo(x, top - 2); g.lineTo(x, top + bh + 4); g.stroke(); }
  // bar ticks
  g.fillStyle = muted;
  for (const b of S.A.downbeats) g.fillRect(X(b), h - 3, 1, 3);
  // playhead
  const pt = t ?? player.time();
  const px = X(pt);
  g.fillStyle = text; g.fillRect(px - 1, 0, 2, h);
  if (tl.hoverX >= 0) {
    const ht = tl.hoverX / w * D;
    const si = segAt(S.plan, ht);
    const label = `${fmt(ht)} · ${SCENES[S.plan.segs[si].scene].name}`;
    g.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    const tw = g.measureText(label).width + 10;
    const lx = Math.min(w - tw, Math.max(0, tl.hoverX - tw / 2));
    g.fillStyle = 'rgba(12,10,18,0.9)'; g.fillRect(lx, 0, tw, 13);
    g.fillStyle = text; g.fillText(label, lx + 5, 7);
  }
}
function seekFromEvent(e) {
  const r = tl.el.getBoundingClientRect();
  const x = Math.min(r.width, Math.max(0, e.clientX - r.left));
  player.seek(x / r.width * S.A.duration);
  S.dirty = true;
}

// ------------------------------------------------------------ scene list
let sceneRows = [];
function renderSceneList() {
  const ul = $('#sceneList');
  if (!sceneRows.length) {
    SCENES.forEach((sc, i) => {
      const li = document.createElement('li');
      li.className = 'scene';
      li.innerHTML = `
        <span class="num">${ROMAN[i]}</span>
        <span class="sw" style="--c:${sc.color}"></span>
        <span class="nm"><b>${sc.name}</b><small>ref ${sc.ref}</small></span>
        <span class="ct" title="Times used in this plan"></span>
        <button type="button" class="pv" id="pv-${sc.id}" aria-pressed="false" title="Preview only this scene">Solo</button>
        <label class="sw-toggle" title="Use this scene"><input type="checkbox" id="en-${sc.id}"><span></span></label>`;
      li.querySelector('input').addEventListener('change', (e) => {
        const on = e.target.checked;
        let en = new Set(S.cfg.enabled);
        if (on) en.add(i); else en.delete(i);
        if (!en.size) { e.target.checked = true; status('Keep at least one scene switched on.', 'error'); return; }
        S.cfg.enabled = [...en].sort((a, b) => a - b);
        replan();
      });
      li.querySelector('.pv').addEventListener('click', () => {
        S.solo = S.solo === i ? null : i;
        renderSceneList(); drawTimeline(); S.dirty = true;
      });
      ul.appendChild(li);
      sceneRows.push(li);
    });
  }
  sceneRows.forEach((li, i) => {
    li.querySelector('input').checked = S.cfg.enabled.includes(i);
    const n = S.plan ? S.plan.counts[i] : 0;
    li.querySelector('.ct').textContent = S.cfg.enabled.includes(i) ? `×${n}` : 'off';
    li.classList.toggle('off', !S.cfg.enabled.includes(i));
    const pv = li.querySelector('.pv');
    pv.setAttribute('aria-pressed', S.solo === i ? 'true' : 'false');
    pv.textContent = S.solo === i ? 'Soloing' : 'Solo';
  });
}
function highlightScene(i) { sceneRows.forEach((li, k) => li.classList.toggle('now', k === i)); }

// ------------------------------------------------------------ export: realtime recording
async function recordRealtime() {
  if (!S.A || S.exporting || S.recording) return;
  const mime = pickRecorderMime();
  if (!mime || !R.canvas.captureStream) { status('This browser can’t record a canvas. Use the frame-perfect render instead.', 'error'); return; }
  const [w, h] = outSize();
  S.solo = null; renderSceneList();
  player.pause(); player.offset = 0;
  renderAt(0, w, h);                       // size the canvas before capture starts
  const vs = R.canvas.captureStream(S.out.fps);
  const as = player.recordStream();
  const stream = new MediaStream([...vs.getVideoTracks(), ...as.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: S.out.mbps * 1e6, audioBitsPerSecond: 192000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  S.recording = true; S.cancel = false; setExportUI(true, 'Recording in real time…');
  const done = new Promise(res => { rec.onstop = res; });
  rec.start(500);
  player.onEnded = () => { if (rec.state !== 'inactive') rec.stop(); };
  await player.play(0);
  updateTransport();
  const tick = setInterval(() => {
    const t = player.time(true);
    $('#exportBar').style.setProperty('--p', Math.round(t / S.A.duration * 100) + '%');
    $('#exportText').textContent = `Recording ${w}×${h} · ${fmt(t)} of ${fmt(S.A.duration)} · keep this tab in front`;
    if (S.cancel && rec.state !== 'inactive') { player.pause(); rec.stop(); }
  }, 250);
  await done;
  clearInterval(tick);
  vs.getTracks().forEach(tr => tr.stop());
  player.onEnded = () => { updateTransport(); S.dirty = true; };
  S.recording = false; updateTransport();
  if (S.cancel) { setExportUI(false); status('Recording cancelled.'); return; }
  const info = Object.assign(describeRecorderMime(mime), { realtime: true });
  finishExport(new Blob(chunks, { type: mime.split(';')[0] }), info.container, info);
}

// ------------------------------------------------------------ export: frame-perfect (WebCodecs)
async function exportFramePerfect() {
  if (!S.A || S.exporting || S.recording) return;
  const [w, h] = outSize(), fps = S.out.fps;
  const enc = await pickVideoEncoder(w, h, fps, S.out.mbps * 1e6);
  if (!enc) { status('Frame-perfect export needs WebCodecs (Chrome or Edge). Use real-time recording here.', 'error'); return; }
  player.pause(); updateTransport();
  S.solo = null; renderSceneList();
  S.exporting = true; S.cancel = false; setExportUI(true, 'Preparing audio…');
  const isCancelled = () => S.cancel;
  let fail = null, ve = null;
  try {
    // Audio first. This is the part X is strict about: AAC-LC, 44.1 or 48 kHz, mono or stereo.
    const abuf = await exportAudioBuffer(player.buffer);
    let ap = await pickAudioPath(abuf.sampleRate, abuf.numberOfChannels);
    if (!ap) throw new Error('this browser can’t encode audio, so the video would be silent. Use Chrome or Edge, or Record in real time');
    const aProg = (p) => {
      const name = ap.mux === 'aac' ? (ap.kind === 'wasm' ? 'AAC, built-in encoder' : 'AAC') : 'Opus';
      $('#exportBar').style.setProperty('--p', Math.round(p * 100) + '%');
      $('#exportText').textContent = `Encoding audio (${name}) · ${Math.round(p * 100)}%`;
    };
    let achunks;
    try {
      achunks = ap.kind === 'wasm' ? await encodeAacWasm(abuf, aProg, isCancelled) : await encodeAudioNative(abuf, ap.cfg, aProg, isCancelled);
    } catch (e) {
      // A native AAC encoder that passes the support check but fails anyway (Windows N without
      // Media Foundation, for one) falls back to the built-in encoder instead of failing the render.
      if (e.cancelled || !(ap.kind === 'native' && ap.mux === 'aac') || !(await loadAacWasm())) throw e;
      console.warn('Native AAC encoder failed, using the built-in one:', e);
      ap = { kind: 'wasm', mux: 'aac' };
      achunks = await encodeAacWasm(abuf, aProg, isCancelled);
    }

    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
      target,
      video: { codec: enc.muxCodec, width: w, height: h, frameRate: fps },
      audio: { codec: ap.mux, numberOfChannels: abuf.numberOfChannels, sampleRate: abuf.sampleRate },
      fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    });
    // interleave: give the muxer audio up to wherever the video has reached
    let ai = 0;
    const feedAudio = (untilUs) => {
      while (ai < achunks.length && achunks[ai].t <= untilUs) { const c = achunks[ai++]; muxer.addAudioChunkRaw(c.d, 'key', c.t, c.dur, c.meta); }
    };
    ve = new VideoEncoder({
      output: (c, m) => { try { muxer.addVideoChunk(c, m); feedAudio(c.timestamp + (c.duration || 0)); } catch (e) { fail = fail || e; } },
      error: (e) => { fail = fail || e; },
    });
    ve.configure(enc.cfg);
    const total = Math.ceil(S.A.duration * fps);
    const t0 = performance.now();
    for (let i = 0; i < total; i++) {
      if (S.cancel || fail) break;
      const t = i / fps;
      const fade = Math.min(1, (S.A.duration - t) / 0.6, t / 0.15 + 0.0001);
      renderAt(t, w, h, Math.max(0, fade));
      const vf = new VideoFrame(R.canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      ve.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (ve.encodeQueueSize > 3 && !fail) await new Promise(r => setTimeout(r, 1));
      if (i % 6 === 0) {
        const el = (performance.now() - t0) / 1000, rate = (i + 1) / fps / el;
        const left = (total - i) / fps / Math.max(0.01, rate);
        $('#exportBar').style.setProperty('--p', Math.round(i / total * 100) + '%');
        $('#exportText').textContent = `Frame ${i + 1} of ${total} · ${rate.toFixed(2)}× real time · about ${fmt(left)} left`;
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (S.cancel) throw cancelError();
    await ve.flush(); ve.close(); ve = null;
    if (fail) throw fail;
    feedAudio(Infinity);
    muxer.finalize();
    S.exporting = false;
    finishExport(new Blob([target.buffer], { type: 'video/mp4' }), 'mp4', {
      container: 'mp4', video: enc.label, audio: ap.mux === 'aac' ? 'AAC' : 'Opus', audioKind: ap.kind,
    });
  } catch (e) {
    if (ve) { try { ve.close(); } catch (x) {} }
    S.exporting = false;
    setExportUI(false);
    if (e && e.cancelled) status('Render cancelled.');
    else { status(`Render failed: ${e && e.message ? e.message : e}`, 'error'); console.error(e); }
  }
  S.dirty = true;
}

function setExportUI(on, text) {
  $('#exportProg').hidden = !on;
  $('#exportText').textContent = text || '';
  $('#exportBar').style.setProperty('--p', '0%');
  $('#fileBtn').disabled = on;
  for (const id of ['#recBtn', '#playBtn']) $(id).disabled = on || !S.A;
  $('#renderBtn').disabled = on || !S.canRender || !S.A;
  $('#cancelBtn').hidden = !on;
  updateTransport();
}
function finishExport(blob, ext, info) {
  setExportUI(false);
  S.lastBlob = blob; S.lastExt = ext;
  const mb = (blob.size / 1048576).toFixed(1);
  const codecs = info.unknown ? '' : ` · ${info.video} + ${info.audio}`;
  $('#saveRow').hidden = false;
  $('#saveInfo').textContent = `${ext.toUpperCase()}${codecs} · ${mb} MB · ${S.out.res.replace('x', '×')} · ${S.out.fps} fps`;
  const v = xVerdict(info);
  renderChips($('#saveChips'), [v, ...xLimitChips(S.A.duration, blob.size)]);
  if (v.level === 'ok') status('Video ready. Save it below.');
  else status(`Video ready, but: ${v.text}. Details below.`, v.level === 'bad' ? 'error' : '');
}

// ------------------------------------------------------------ export guidance (estimate, pre-flight, chips)
function renderChips(el, chips) {
  el.replaceChildren(...chips.map((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.level = c.level;
    b.textContent = c.text; b.title = c.tip; b.setAttribute('aria-label', `${c.text}. ${c.tip}`);
    b.addEventListener('click', openXHelp);
    return b;
  }));
  el.hidden = !chips.length;
}
function openXHelp() { const d = $('#xHelp'); d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
const fmtSize = (b) => b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1048576))} MB`;
const fmtLen = (t) => { const s = Math.round(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function updateEstimate() {
  if (!S.A) return;
  const [w, h] = outSize(), secs = S.A.duration;
  const bytes = (S.out.mbps * 1e6 + 192000) * secs / 8;
  $('#estimate').textContent = `About ${fmtSize(bytes)} · ${fmtLen(secs)} · ${w}×${h} · ${S.out.fps} fps`;
  renderChips($('#estChips'), xLimitChips(secs, bytes));
}
let preflightSeq = 0;
async function updatePreflight() {
  const seq = ++preflightSeq;
  const [w, h] = outSize();
  const p = await probeExport(w, h, S.out.fps, S.out.mbps * 1e6);
  if (seq !== preflightSeq) return;
  let level = 'ok', text, tip;
  if (!p.video) {
    level = 'bad'; text = 'Render MP4 isn’t available in this browser';
    tip = 'Frame-perfect rendering needs WebCodecs (Chrome or Edge). Real-time recording still works.';
  } else if (!p.audio) {
    level = 'bad'; text = 'No audio encoder here, so renders are off';
    tip = 'This browser can’t encode audio, and a render would come out silent. Use Chrome or Edge, or Record in real time.';
  } else if (p.video !== 'H.264' || p.audio !== 'AAC') {
    level = 'warn'; text = `Writes ${p.video} + ${p.audio} · not X-ready`;
    tip = 'This browser can’t write the H.264 + AAC combination X needs. The MP4 will play in VLC and browsers, but X will refuse it. Render in Chrome or Edge on Windows or Mac.';
  } else if (p.audioKind === 'wasm') {
    text = 'Writes H.264 + AAC (built-in encoder) · X-ready';
    tip = 'This browser has no AAC encoder of its own, so Timewarp uses the one built into this page. Audio takes a few extra seconds to encode.';
  } else {
    text = 'Writes H.264 + AAC · X-ready';
    tip = 'MP4 with H.264 video and AAC-LC audio, the format X recommends.';
  }
  S.canRender = !!(p.video && p.audio);
  if (!S.exporting && !S.recording) $('#renderBtn').disabled = !S.canRender || !S.A;
  const el = $('#preflight');
  el.dataset.level = level; el.textContent = text; el.title = tip;
}

async function saveLast() {
  if (!S.lastBlob) return;
  const base = (S.name || 'timewarp').replace(/[^\w\- .]+/g, '').trim() || 'timewarp';
  const filename = `${base} - timewarp.${S.lastExt}`;
  const dl = await dlCap;
  if (dl) {
    try { await dl.save({ filename, data: S.lastBlob }); status('Saved.'); return; }
    catch (e) { if (e && e.code === 'declined') { status('Save cancelled.'); return; } }
  }
  const url = URL.createObjectURL(S.lastBlob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  status('Download started.');
}

// ------------------------------------------------------------ settings wiring
function bindSettings() {
  const num = (id, key, fmtFn, obj = 'cfg') => {
    const el = $('#' + id), out = $('#' + id + 'Val');
    el.value = S[obj][key];
    const show = () => { if (out) out.textContent = fmtFn ? fmtFn(+el.value) : el.value; };
    show();
    el.addEventListener('input', () => { S[obj][key] = +el.value; show(); if (obj === 'cfg') { if (key === 'minSeg' && S.cfg.maxSeg < S.cfg.minSeg) { S.cfg.maxSeg = S.cfg.minSeg; $('#maxSeg').value = S.cfg.minSeg; $('#maxSegVal').textContent = S.cfg.minSeg + ' s'; } if (key === 'maxSeg' && S.cfg.minSeg > S.cfg.maxSeg) { S.cfg.minSeg = S.cfg.maxSeg; $('#minSeg').value = S.cfg.maxSeg; $('#minSegVal').textContent = S.cfg.maxSeg + ' s'; } } S.dirty = true; });
    el.addEventListener('change', () => { if (obj === 'cfg' && key !== 'react') replan(); else { store.set(obj, S[obj]); store.set('cfg', S.cfg); } });
  };
  num('minSeg', 'minSeg', v => v + ' s');
  num('maxSeg', 'maxSeg', v => v + ' s');
  num('fxAmt', 'fx', v => Math.round(v * 100) + '%');
  num('react', 'react', v => Math.round(v * 100) + '%');
  const sel = (id, key, obj = 'cfg', cast = (v) => v) => {
    const el = $('#' + id);
    el.value = String(S[obj][key]);
    el.addEventListener('change', () => {
      S[obj][key] = cast(el.value); store.set(obj, S[obj]);
      if (obj === 'cfg') replan();
      if (obj === 'out' && key !== 'preview') { updateEstimate(); updatePreflight(); }
      applyAspect(); S.dirty = true;
    });
  };
  sel('cutOn', 'cutOn');
  sel('transStyle', 'transStyle');
  sel('res', 'res', 'out');
  sel('fps', 'fps', 'out', Number);
  sel('mbps', 'mbps', 'out', Number);
  sel('preview', 'preview', 'out', Number);
  const chk = (id, key) => { const el = $('#' + id); el.checked = !!S.cfg[key]; el.addEventListener('change', () => { S.cfg[key] = el.checked; replan(); }); };
  chk('followSections', 'followSections');
  chk('energyMatch', 'energyMatch');
  $('#seed').value = S.cfg.seed;
  $('#seed').addEventListener('change', () => { S.cfg.seed = Math.max(1, Math.floor(+$('#seed').value || 1)); replan(); });
  $('#shuffleBtn').addEventListener('click', () => { S.cfg.seed = (S.cfg.seed % 9999) + 1; $('#seed').value = S.cfg.seed; replan(); });
}
function applyAspect() {
  const [w, h] = outSize();
  $('#stage').style.setProperty('--ar', `${w} / ${h}`);
  $('#stage').classList.toggle('tall', h > w);
}

// ------------------------------------------------------------ boot
let meterEls = [];
async function boot() {
  const canvas = $('#view');
  try { R = new Renderer(canvas); }
  catch (e) { status(e.message, 'error'); $('#overlayTitle').textContent = 'WebGL2 unavailable'; $('#overlayText').textContent = 'This browser or graphics driver can’t run the shaders. Try Chrome or Edge, and update your graphics driver.'; return; }
  applyAspect();
  bindSettings();
  meterEls = [...document.querySelectorAll('#meters .m')];
  tl.el = $('#timeline'); tl.ctx = tl.el.getContext('2d');
  tl.el.addEventListener('pointerdown', (e) => { if (!S.A || S.exporting || S.recording) return; tl.drag = true; tl.el.setPointerCapture(e.pointerId); seekFromEvent(e); });
  tl.el.addEventListener('pointermove', (e) => { const r = tl.el.getBoundingClientRect(); tl.hoverX = e.clientX - r.left; if (tl.drag) seekFromEvent(e); else if (!player.playing) drawTimeline(); });
  tl.el.addEventListener('pointerup', () => { tl.drag = false; });
  tl.el.addEventListener('pointerleave', () => { tl.hoverX = -1; if (!player.playing) drawTimeline(); });
  window.addEventListener('resize', () => drawTimeline());

  $('#playBtn').addEventListener('click', togglePlay);
  $('#bigPlay').addEventListener('click', togglePlay);
  $('#fileBtn').addEventListener('click', () => $('#file').click());
  $('#overlayFile').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  $('#recBtn').addEventListener('click', recordRealtime);
  $('#renderBtn').addEventListener('click', exportFramePerfect);
  $('#cancelBtn').addEventListener('click', () => { S.cancel = true; });
  $('#saveBtn').addEventListener('click', saveLast);
  $('#fsBtn').addEventListener('click', () => { const st = $('#stage'); (document.fullscreenElement ? document.exitFullscreen() : st.requestFullscreen && st.requestFullscreen())?.catch?.(() => {}); });
  const stage = $('#stage');
  ['dragenter', 'dragover'].forEach(ev => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('drop'); }));
  ['dragleave', 'drop'].forEach(ev => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove('drop'); }));
  stage.addEventListener('drop', (e) => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight' && S.A && !S.recording && !S.exporting) { player.seek(player.time() + 5); S.dirty = true; }
    else if (e.code === 'ArrowLeft' && S.A && !S.recording && !S.exporting) { player.seek(player.time() - 5); S.dirty = true; }
  });
  if (typeof VideoEncoder === 'undefined') { $('#renderBtn').disabled = true; $('#renderNote').textContent = 'Frame-perfect render needs Chrome or Edge (WebCodecs). Real-time recording works here.'; }
  const recMime = pickRecorderMime();
  if (recMime && !/^video\/mp4/.test(recMime)) $('#recBtn').title += ' This browser records WebM, which X won’t accept.';

  status('Compiling shaders…');
  progress(0);
  try {
    await R.compileAll(buildProgramDefs(), (p, name) => { progress(p * 0.5); status(`Compiling shaders… ${name}`); });
  } catch (e) {
    progress(null); status('A shader failed to compile on this GPU. Details are in the console.', 'error'); $('#overlayTitle').textContent = 'Shaders failed to compile'; $('#overlayText').textContent = 'Details are in the browser console. Updating your graphics driver may help.'; console.error(e); return;
  }
  try { await Promise.race([document.fonts.load('80px "Caveat"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  R.setMathAtlas(buildMathAtlas());
  S.ready = true;
  requestAnimationFrame(frame);
  progress(null);
  status('Load a song to start.');
  setOverlay('Load a song to start', 'Drop an audio file on this frame, or click the button. MP3, WAV, M4A, AAC, OGG, FLAC and Opus all work.', 'Load audio file', false);
  updatePreflight();
}
boot();
