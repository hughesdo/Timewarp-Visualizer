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
  A: null, plan: null, name: '', isDemo: true,
  cfg: Object.assign({ enabled: SCENES.map((_, i) => i), minSeg: 4, maxSeg: 10, cutOn: 'bar', transStyle: 'mixed', fx: 0.6, react: 1.0, seed: 1, followSections: true, energyMatch: true }, store.get('cfg', {})),
  out: Object.assign({ res: '1920x1080', fps: 60, mbps: 16, preview: 0.5 }, store.get('out', {})),
  solo: null, recording: false, exporting: false, cancel: false, dirty: true, ready: false,
  lastBlob: null,
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
async function useBuffer(buf, name, isDemo) {
  player.setBuffer(buf);
  S.name = name; S.isDemo = !!isDemo;
  $('#trackName').textContent = name;
  status('Analyzing the track…');
  progress(0);
  S.A = await analyzeAudio(buf, p => progress(p));
  progress(null);
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
  status(isDemo ? 'Demo beat loaded. Press play, or load your own track.' : `Loaded “${name}”. Press play to preview.`);
  $('#overlay').hidden = false;
  $('#overlayTitle').textContent = isDemo ? 'Demo beat ready' : name;
  updateTransport();
}

async function loadFile(file) {
  if (!file) return;
  if (S.recording || S.exporting) return;
  try {
    status(`Decoding “${file.name}”…`);
    progress(0.02);
    const ab = await file.arrayBuffer();
    const ctx = player.ensure();
    const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    await useBuffer(buf, file.name.replace(/\.[^.]+$/, ''), false);
  } catch (e) {
    progress(null);
    status(`Couldn’t read that file. Try an MP3, WAV, M4A, OGG or FLAC.`, 'error');
    console.error(e);
  }
}

async function loadDemo() {
  status('Building the demo beat…');
  progress(0.05);
  const buf = await synthDemo();
  await useBuffer(buf, 'Demo beat · 124 BPM', true);
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
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: S.out.mbps * 1e6, audioBitsPerSecond: 256000 });
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
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  finishExport(new Blob(chunks, { type: mime.split(';')[0] }), ext);
}

// ------------------------------------------------------------ export: frame-perfect (WebCodecs)
async function resample(buf, sr) {
  const ch = Math.min(2, buf.numberOfChannels);
  const oc = new OfflineAudioContext(ch, Math.ceil(buf.duration * sr), sr);
  const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
  return await oc.startRendering();
}
async function exportFramePerfect() {
  if (!S.A || S.exporting || S.recording) return;
  const [w, h] = outSize(), fps = S.out.fps;
  const enc = await pickEncoderConfig(w, h, fps, S.out.mbps * 1e6);
  if (!enc) { status('Frame-perfect export needs WebCodecs (Chrome or Edge). Use real-time recording here.', 'error'); return; }
  player.pause(); updateTransport();
  S.solo = null; renderSceneList();
  S.exporting = true; S.cancel = false; setExportUI(true, 'Preparing encoder…');
  let fail = null;
  try {
    let abuf = player.buffer;
    if (abuf.numberOfChannels > 2) abuf = await resample(abuf, abuf.sampleRate);
    let acfg = await pickAudioConfig(abuf.sampleRate, abuf.numberOfChannels);
    if (!acfg) { abuf = await resample(abuf, 48000); acfg = await pickAudioConfig(48000, abuf.numberOfChannels); }
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
      target,
      video: { codec: enc.muxCodec, width: w, height: h, frameRate: fps },
      audio: acfg ? { codec: acfg.mux, numberOfChannels: abuf.numberOfChannels, sampleRate: abuf.sampleRate } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    });
    // audio
    if (acfg) {
      const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { fail = e; } });
      ae.configure(acfg.cfg);
      const CH = abuf.numberOfChannels, SR = abuf.sampleRate, N = 4096;
      const chans = []; for (let c = 0; c < CH; c++) chans.push(abuf.getChannelData(c));
      for (let i = 0; i < abuf.length && !fail; i += N) {
        const n = Math.min(N, abuf.length - i);
        const data = new Float32Array(n * CH);
        for (let c = 0; c < CH; c++) data.set(chans[c].subarray(i, i + n), c * n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: CH, timestamp: Math.round(i / SR * 1e6), data });
        ae.encode(ad); ad.close();
        if (ae.encodeQueueSize > 32) await new Promise(r => setTimeout(r, 0));
      }
      await ae.flush(); ae.close();
    }
    // video
    const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { fail = e; } });
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
    if (S.cancel) { try { ve.close(); } catch (e) {} throw new Error('cancelled'); }
    await ve.flush(); ve.close();
    if (fail) throw fail;
    muxer.finalize();
    S.exporting = false;
    finishExport(new Blob([target.buffer], { type: 'video/mp4' }), 'mp4');
  } catch (e) {
    S.exporting = false;
    setExportUI(false);
    if (String(e && e.message) === 'cancelled') status('Render cancelled.');
    else { status(`Render failed: ${e && e.message ? e.message : e}`, 'error'); console.error(e); }
  }
  S.dirty = true;
}

function setExportUI(on, text) {
  $('#exportProg').hidden = !on;
  $('#exportText').textContent = text || '';
  $('#exportBar').style.setProperty('--p', '0%');
  for (const id of ['#recBtn', '#renderBtn', '#fileBtn', '#demoBtn', '#playBtn']) $(id).disabled = on;
  $('#cancelBtn').hidden = !on;
  updateTransport();
}
function finishExport(blob, ext) {
  setExportUI(false);
  S.lastBlob = blob; S.lastExt = ext;
  const mb = (blob.size / 1048576).toFixed(1);
  $('#saveRow').hidden = false;
  $('#saveInfo').textContent = `${ext.toUpperCase()} · ${mb} MB · ${S.out.res.replace('x', '×')} · ${S.out.fps} fps`;
  status('Video ready. Save it below.');
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
    el.addEventListener('change', () => { S[obj][key] = cast(el.value); store.set(obj, S[obj]); if (obj === 'cfg') replan(); applyAspect(); S.dirty = true; });
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
  catch (e) { status(e.message, 'error'); $('#overlayTitle').textContent = 'WebGL2 unavailable'; return; }
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
  $('#demoBtn').addEventListener('click', () => { if (!S.recording && !S.exporting) { player.stop(); loadDemo(); } });
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

  status('Compiling shaders…');
  progress(0);
  try {
    await R.compileAll(buildProgramDefs(), (p, name) => { progress(p * 0.5); status(`Compiling shaders… ${name}`); });
  } catch (e) {
    progress(null); status('A shader failed to compile on this GPU. Details are in the console.', 'error'); console.error(e); return;
  }
  try { await Promise.race([document.fonts.load('80px "Caveat"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  R.setMathAtlas(buildMathAtlas());
  S.ready = true;
  requestAnimationFrame(frame);
  await loadDemo();
  player.offset = Math.min(S.A.duration * 0.33, 8.2);
  S.dirty = true;
}
boot();
