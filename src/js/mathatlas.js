// Chalk formula atlas: 8 cols x 4 rows of handwritten-ish math, drawn with Canvas2D.
// R channel = ink. Used by Equation Nebula, Chalkboard Mandala, Eclipse backdrops.
function buildMathAtlas(W = 2048, H = 1024, font = '"Caveat", "Segoe Print", "Bradley Hand", cursive') {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  let s = 1234567;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const formulas = [
    'E = mc²', 'αx² + bx + c', 'sin[π/2 − θ] = cos θ', '∫ x·eˣ dx = eˣ(x − 1)',
    'x = (−b ± √(b² − 4ac)) / 2a', 'Δt′ = Δt / √(1 − v²/c²)', 'eⁱᵖ + 1 = 0', '∮ E·dA = Q/ε₀',
    'f(t) = Σ aₙ cos(nωt)', 'ψ(x,t) = A e^{i(kx−ωt)}', 'dS ≥ δQ / T', 'F = G m₁m₂ / r²',
    'λ = h / p', 'τ = 2π √(L/g)', '∇ × B = μ₀J', 'lim n→∞ (1 + 1/n)ⁿ = e',
    'x(t) = A sin(ωt + φ)', 'ds² = −c²dt² + dx²', 'Γ(n) = (n − 1)!', 'tan θ = sin θ / cos θ',
    'Hz = 1 / s', '∂²u/∂t² = c²∇²u', 'ω = 2πf', 'P(A|B) = P(B|A)P(A) / P(B)'
  ];
  const cols = 8, rows = 4, cw = W / cols, ch = H / rows;
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineCap = 'round'; g.lineJoin = 'round';
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, k++) {
    const x0 = c * cw, y0 = r * ch;
    g.save();
    g.beginPath(); g.rect(x0 + 4, y0 + 4, cw - 8, ch - 8); g.clip();
    const kind = (k * 7 + 3) % 5;
    if (kind === 4) {
      // little graph: axes + curve
      const ox = x0 + cw * (0.2 + rnd() * 0.15), oy = y0 + ch * (0.62 + rnd() * 0.1);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(ox - 20, oy); g.lineTo(x0 + cw * 0.92, oy); g.moveTo(ox, oy + 30); g.lineTo(ox, y0 + ch * 0.15); g.stroke();
      g.lineWidth = 3.5; g.beginPath();
      const typ = Math.floor(rnd() * 3);
      for (let i = 0; i <= 60; i++) {
        const u = i / 60, X = ox + u * cw * 0.65;
        let Y = typ === 0 ? oy - Math.sin(u * Math.PI * 2) * ch * 0.22 : typ === 1 ? oy - u * u * ch * 0.45 : oy - (1 - Math.exp(-u * 4)) * ch * 0.4;
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.stroke();
      g.font = `${Math.round(ch * 0.16)}px ${font}`;
      g.fillText(['f(x)', 'y', 'θ', '(0,1)'][Math.floor(rnd() * 4)], ox + 10, y0 + ch * 0.2);
      // circle diagram sometimes
      if (rnd() < 0.5) { g.lineWidth = 2.5; g.beginPath(); g.arc(x0 + cw * 0.75, y0 + ch * 0.35, ch * 0.16, 0, Math.PI * 2); g.stroke(); }
    } else {
      const f = formulas[k % formulas.length];
      const size = Math.round(ch * (0.2 + rnd() * 0.12));
      g.font = `${size}px ${font}`;
      let tw = g.measureText(f).width;
      const fit = Math.min(1, (cw * 0.9) / tw);
      g.font = `${Math.round(size * fit)}px ${font}`;
      g.fillText(f, x0 + cw * 0.05, y0 + ch * (0.45 + rnd() * 0.2));
      // smaller sub-line
      g.font = `${Math.round(ch * 0.1)}px ${font}`;
      g.globalAlpha = 0.75;
      g.fillText(formulas[(k * 5 + 2) % formulas.length], x0 + cw * 0.08, y0 + ch * 0.85);
      g.globalAlpha = 1;
    }
    g.restore();
  }
  return cv;
}
if (typeof window !== 'undefined') window.buildMathAtlas = buildMathAtlas;
