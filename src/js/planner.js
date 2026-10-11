// ============================================================ scene registry + timeline planner
const SCENES = [
  { id: 'mandala',   name: 'Chrono Mandala',     libs: ['mandala_lib'], energy: 0.60, fam: 'dial',  color: '#ff6f9d', ref: '0:00 · 0:14 · 0:19 · 0:26', post: { rgb: 0.0008 } },
  { id: 'falls',     name: 'Portal Falls',       libs: [],              energy: 0.80, fam: 'falls', color: '#ff4fb7', ref: '0:02 · 0:08' },
  { id: 'tunnel',    name: 'Clock Tunnel',       libs: [],              energy: 0.95, fam: 'warp',  color: '#f5c46b', ref: '0:06' },
  { id: 'nebula',    name: 'Equation Nebula',    libs: [],              energy: 0.30, fam: 'falls', color: '#4f7dff', ref: '0:09' },
  { id: 'lenses',    name: 'Twin Lenses',        libs: [],              energy: 0.45, fam: 'lens',  color: '#9fb4ff', ref: '0:11' },
  { id: 'ink',       name: 'Ink Negative',       libs: ['mandala_lib'], energy: 0.55, fam: 'dial',  color: '#dfe8ea', ref: '0:13' },
  { id: 'vortex',    name: 'Clock Vortex',       libs: [],              energy: 0.75, fam: 'warp',  color: '#9a6bff', ref: '0:15 · 0:18' },
  { id: 'starburst', name: 'Starburst',          libs: [],              energy: 0.85, fam: 'warp',  color: '#8f9dff', ref: '0:17' },
  { id: 'eclipse',   name: 'Eclipse Ring',       libs: ['eclipse_lib'], energy: 0.35, fam: 'ring',  color: '#ffb48a', ref: '0:21' },
  { id: 'tiles',     name: 'Eclipse Tiles',      libs: ['eclipse_lib'], energy: 0.65, fam: 'ring',  color: '#4fd2ff', ref: '0:20' },
  { id: 'chalk',     name: 'Chalkboard Mandala', libs: ['mandala_lib'], energy: 0.50, fam: 'dial',  color: '#c9c3b8', ref: '0:23', post: { rgb: 0.0022 } },
  { id: 'led',       name: 'LED Spectrum',       libs: [],              energy: 0.90, fam: 'led',   color: '#7dff9a', ref: '0:17.6' },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const TRANS = { cut: 0, flash: 1, flare: 2, zoom: 3, barwipe: 4, pixel: 5, glitch: 6, curve: 7, smear: 8 };
const TRANS_NAMES = Object.keys(TRANS);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const pickR = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
function shuffleR(rnd, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function planTimeline(A, cfg) {
  const rnd = mulberry32(cfg.seed * 7919 + 17);
  const D = A.duration;
  const enabled = cfg.enabled.length ? cfg.enabled.slice() : SCENES.map((_, i) => i);
  const N = enabled.length;
  const beatP = A.beats.length > 2 ? (A.beats[A.beats.length - 1] - A.beats[0]) / (A.beats.length - 1) : 0.5;

  // grid of allowed cut points
  let grid = cfg.cutOn === 'beat' ? A.beats : cfg.cutOn === 'phrase' ? A.downbeats.filter((_, i) => i % 2 === 0) : A.downbeats;
  if (grid.length < 4) { grid = []; for (let t = 0; t < D; t += 2) grid.push(t); }
  const snap = (t) => {
    let lo = 0, hi = grid.length - 1;
    if (t <= grid[0]) return grid[0];
    if (t >= grid[hi]) return grid[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (grid[m] <= t) lo = m; else hi = m; }
    return (t - grid[lo] < grid[hi] - t) ? grid[lo] : grid[hi];
  };
  const snapUp = (t) => { for (const g of grid) if (g >= t) return g; return D; };

  // every scene must appear: cap segment length so the song fits all of them
  const maxEff = Math.max(1.2, Math.min(cfg.maxSeg, D / N));
  const minEff = Math.max(0.8, Math.min(cfg.minSeg, maxEff * 0.8));

  // section changes are mandatory cuts
  const secs = (cfg.followSections ? A.sections : []).map(s => ({ t: snap(s.t), strength: s.strength }))
    .filter(s => s.t > minEff * 0.6 && s.t < D - minEff * 0.6);
  const bounds = [{ t: 0 }].concat(secs, [{ t: D, end: true }]);
  const cuts = [];
  for (let b = 0; b < bounds.length - 1; b++) {
    const a = bounds[b].t, z = bounds[b + 1].t;
    let t = a;
    for (let guard = 0; guard < 400; guard++) {
      const len = minEff + rnd() * (maxEff - minEff);
      let nx = snap(t + len);
      if (nx <= t + minEff * 0.5) nx = snapUp(t + minEff);
      if (nx >= z - minEff * 0.5) break;
      cuts.push({ t: nx, big: false });
      t = nx;
    }
    if (!bounds[b + 1].end) cuts.push({ t: z, big: true, strength: bounds[b + 1].strength });
  }
  cuts.sort((x, y) => x.t - y.t);
  // dedupe
  for (let i = cuts.length - 1; i > 0; i--) if (cuts[i].t - cuts[i - 1].t < 0.25) { cuts[i - 1].big = cuts[i - 1].big || cuts[i].big; cuts.splice(i, 1); }

  let segs = [];
  let prevT = 0;
  for (const c of cuts) { segs.push({ start: prevT, end: c.t }); prevT = c.t; }
  segs.push({ start: prevT, end: D });
  // split the longest segments until every enabled scene can appear
  for (let guard = 0; segs.length < N && guard < 200; guard++) {
    let li = 0; segs.forEach((s, i) => { if (s.end - s.start > segs[li].end - segs[li].start) li = i; });
    const s = segs[li];
    if (s.end - s.start < 1.6) break;
    let mid = (s.start + s.end) / 2;
    const ms = snap(mid);
    if (ms - s.start > 0.6 && s.end - ms > 0.6) mid = ms;
    segs.splice(li, 1, { start: s.start, end: mid }, { start: mid, end: s.end });
    cuts.push({ t: mid, big: false });
  }
  cuts.sort((x, y) => x.t - y.t);

  // segment energy (rank among segments)
  for (const s of segs) {
    const i0 = Math.floor(s.start * A.fps), i1 = Math.max(i0 + 1, Math.floor(s.end * A.fps));
    let e = 0; for (let i = i0; i < i1 && i < A.n; i++) e += A.level[i] * 0.7 + A.bands.bass[i] * 0.3;
    s.e = e / (i1 - i0);
  }
  const sortedE = segs.map(s => s.e).sort((a, b) => a - b);
  for (const s of segs) s.energy = sortedE.length > 1 ? sortedE.indexOf(s.e) / (sortedE.length - 1) : 0.5;

  // assign scenes: shuffle bag, every scene before any repeat, energy-matched
  let bag = [];
  let prev = -1;
  for (const s of segs) {
    if (!bag.length) bag = shuffleR(rnd, enabled);
    let cand = bag.filter(x => x !== prev);
    if (!cand.length) cand = bag;
    let best = cand[0], bs = -1e9;
    for (const c of cand) {
      const sc = SCENES[c];
      let v = -Math.abs(s.energy - sc.energy) * (cfg.energyMatch ? 1.4 : 0.2) + rnd() * 0.8;
      if (prev >= 0 && SCENES[prev].fam === sc.fam) v -= 0.6;
      if (v > bs) { bs = v; best = c; }
    }
    bag.splice(bag.indexOf(best), 1);
    s.scene = best; s.seed = rnd(); s.variant = rnd();
    prev = best;
  }

  // transitions
  const pools = {
    mixed:  { big: ['flash', 'flare', 'barwipe', 'zoom', 'curve', 'glitch', 'pixel'], small: ['cut', 'cut', 'glitch', 'zoom', 'pixel', 'smear', 'barwipe', 'flash'] },
    smooth: { big: ['flash', 'zoom', 'flare', 'smear'], small: ['zoom', 'smear', 'flash'] },
    hard:   { big: ['flash', 'cut', 'glitch'], small: ['cut'] },
  };
  const pool = pools[cfg.transStyle] || pools.mixed;
  const trans = [];
  for (const c of cuts) {
    const type = pickR(rnd, c.big ? pool.big : pool.small);
    const dur = type === 'cut' ? 0.05 : Math.min(0.9, Math.max(0.16, (c.big ? 1.0 : 0.5) * beatP * (type === 'curve' ? 2 : 1)));
    trans.push({
      t: c.t, t0: c.t - dur / 2, t1: c.t + dur / 2, dur, type, id: TRANS[type], big: !!c.big,
      ang: pickR(rnd, [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -Math.PI / 4]),
      fx: (rnd() - 0.5) * 0.9, fy: (rnd() - 0.5) * 0.5, hue: rnd(),
    });
  }

  // FX events on strong onsets
  const fxAmt = cfg.fx;
  const fx = [];
  const nearCut = (t) => trans.some(tr => t > tr.t0 - 0.15 && t < tr.t1 + 0.15);
  const lastBy = {};
  const can = (type, t, gap) => !(lastBy[type] !== undefined && t - lastBy[type] < gap);
  const add = (e) => { fx.push(e); lastBy[e.type] = e.t; };
  if (fxAmt > 0) {
    for (const o of A.onsets.snare) {
      if (o.s < 0.55 || rnd() > fxAmt * 0.55 || nearCut(o.t) || !can('bar', o.t, beatP * 1.5)) continue;
      add({ type: 'bar', t: o.t, dur: 0.12 + rnd() * 0.2, amp: 0.95, ang: pickR(rnd, [0, 0, Math.PI / 4, -Math.PI / 4, Math.PI / 2]), pos: (rnd() - 0.5) * 0.9, w: 0.03 + rnd() * 0.04, drift: (rnd() - 0.5) * 0.6, two: rnd() < 0.25 });
    }
    for (const o of A.onsets.kick) {
      if (o.s < 0.7 || rnd() > fxAmt * 0.22 || nearCut(o.t)) continue;
      const type = pickR(rnd, ['flare', 'zoom', 'zoom', 'rgb', 'rgb', 'flash']);
      if (!can(type, o.t, beatP * 4)) continue;
      add({ type, t: o.t, dur: { flare: 0.3, zoom: 0.22, rgb: 0.18, flash: 0.12 }[type], amp: 1, fx: (rnd() - 0.5) * 0.9, fy: (rnd() - 0.5) * 0.4, hue: rnd() });
    }
    for (const o of A.onsets.hat) {
      if (o.s < 0.6 || rnd() > fxAmt * 0.07 || nearCut(o.t) || !can('slice', o.t, beatP * 2)) continue;
      add({ type: 'slice', t: o.t, dur: 0.14, amp: 1 });
    }
    // longer "looks" on downbeats
    for (const t of A.downbeats) {
      if (rnd() > fxAmt * 0.11 || nearCut(t) || nearCut(t + beatP * 2)) continue;
      const type = pickR(rnd, ['led', 'edge', 'edge', 'invert', 'echo', 'wash', 'bolt', 'led']);
      if (!can(type, t, beatP * 8)) continue;
      const beatsLen = { led: 2, edge: 2, invert: 0.5, echo: 2, wash: 0.5, bolt: 0.4 }[type];
      add({ type, t, dur: beatsLen * beatP, amp: 1 });
    }
  }
  fx.sort((a, b) => a.t - b.t);

  const counts = new Array(SCENES.length).fill(0);
  for (const s of segs) counts[s.scene]++;
  return { segs, trans, fx, counts, beatP };
}

// ---- envelopes
const envPunch = (u) => u < 0.1 ? u / 0.1 : Math.pow(Math.max(0, 1 - (u - 0.1) / 0.9), 1.5);
const envHold = (u) => u < 0.7 ? 1 : Math.max(0, (1 - u) / 0.3);
const envPlateau = (u) => Math.min(1, u / 0.08) * Math.min(1, (1 - u) / 0.15);

function segAt(plan, t) {
  const s = plan.segs;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].start <= t) lo = m; else hi = m - 1; }
  return lo;
}

// Everything the renderer needs for time t
function frameState(A, plan, t, cfg, aspect, soloScene) {
  const au = sampleAnalysis(A, t);
  const st = {
    t, au, a: null, b: null, mix: 0, trans: 0, wipeAng: 0,
    fx: { zoom: 0, rgb: 0, flash: 0, wash: 0, invert: 0, led: 0, edge: 0, slice: 0, curve: 0, smear: 0, bolt: 0, echo: 0, bar: [0, 0, 0, 0.05], bar2: [0, 0, 0, 0.05], flare: [0, 0, 0, 0] },
  };
  const fxK = cfg.fx;
  if (soloScene != null) {
    st.a = { scene: soloScene, start: 0, seed: 0.37, variant: 0.2 };
  } else {
    const si = segAt(plan, t);
    st.a = plan.segs[si];
    // transition window?
    for (const tr of plan.trans) {
      if (t < tr.t0) break;
      if (t <= tr.t1) {
        const nextI = segAt(plan, tr.t + 1e-4), prevI = Math.max(0, nextI - 1);
        st.a = plan.segs[prevI]; st.b = plan.segs[nextI];
        st.mix = Math.min(1, Math.max(0, (t - tr.t0) / tr.dur));
        st.trans = tr.id; st.wipeAng = tr.ang;
        const s = Math.sin(Math.PI * st.mix);
        switch (tr.type) {
          case 'flash': st.fx.flash += 0.9 * s * s; break;
          case 'flare': st.fx.flare = [s, tr.fx, tr.fy, tr.hue]; break;
          case 'zoom': st.fx.zoom += s * 1.2; st.fx.rgb += 0.006 * s; break;
          case 'barwipe': {
            const d = [Math.cos(tr.ang), Math.sin(tr.ang)];
            const ext = 0.5 * (Math.abs(d[0]) * aspect + Math.abs(d[1]));
            const reach = ext + 0.1;
            const pos = (-reach + 2 * reach * st.mix) / ext;
            st.fx.bar = [1, tr.ang, pos, 0.045];
            break;
          }
          case 'pixel': st.fx.led += s; break;
          case 'glitch': st.fx.slice += s; st.fx.rgb += 0.012 * s; break;
          case 'curve': st.fx.curve += s; break;
          case 'smear': st.fx.smear += s; break;
        }
        break;
      }
    }
    // FX events
    for (let k = 0; k < plan.fx.length; k++) {
      const e = plan.fx[k];
      if (e.t > t) break;
      if (t > e.t + e.dur) continue;
      const u = (t - e.t) / e.dur;
      switch (e.type) {
        case 'bar': {
          const a = e.amp * envHold(u);
          const v = [a, e.ang, e.pos + e.drift * u, e.w];
          if (st.fx.bar[0] < 0.01) st.fx.bar = v; else st.fx.bar2 = v;
          if (e.two) st.fx.bar2 = [a, e.ang + Math.PI / 2, -e.pos * 0.6, e.w * 0.8];
          break;
        }
        case 'flare': st.fx.flare = [envPunch(u), e.fx, e.fy, e.hue]; break;
        case 'zoom': st.fx.zoom += 0.9 * envPunch(u); break;
        case 'rgb': st.fx.rgb += 0.014 * envPunch(u); break;
        case 'flash': st.fx.flash += 0.45 * envPunch(u); break;
        case 'slice': st.fx.slice += envPlateau(u); break;
        case 'led': st.fx.led = Math.max(st.fx.led, envPlateau(u)); break;
        case 'edge': st.fx.edge = Math.max(st.fx.edge, envPlateau(u)); break;
        case 'invert': st.fx.invert = Math.max(st.fx.invert, envPlateau(u)); break;
        case 'echo': st.fx.echo = Math.max(st.fx.echo, 0.8 * envPlateau(u)); break;
        case 'wash': st.fx.wash = Math.max(st.fx.wash, 0.6 * envPunch(u)); break;
        case 'bolt': st.fx.bolt = Math.max(st.fx.bolt, envPunch(u)); break;
      }
    }
  }
  // continuous audio-driven post: subtle punch on kicks
  const sc = SCENES[st.a.scene];
  st.fx.rgb += (sc.post && sc.post.rgb || 0) + au.kick * 0.004 * fxK;
  st.fx.zoom += au.kick * au.kick * 0.08 * fxK;
  return st;
}
