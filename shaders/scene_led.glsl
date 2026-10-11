// Scene: LED SPECTRUM — dot-matrix render of a live spectrum analyzer and drifting clocks
vec3 ledContent(vec2 p, float t){
  vec3 col = vec3(0.0);
  // spectrum bars along the bottom, rainbow
  float nb = 48.0;
  float bx = (p.x + 0.89)/1.78;
  float bi = floor(bx*nb);
  float bf = fract(bx*nb);
  float v = spec((bi + 0.5)/nb);
  float hgt = v*0.75*(0.6 + 0.6*uReact);
  float barY = p.y + 0.5;
  if (bf > 0.12 && bf < 0.88 && barY < hgt && bx > 0.0 && bx < 1.0){
    vec3 c = hsv(bi/nb*0.85 + 0.6 + barY*0.3, 0.85, 1.0);
    col += c*(0.6 + 0.6*barY/max(hgt, 0.01));
  }
  // peak caps
  if (bf > 0.12 && bf < 0.88 && abs(barY - hgt - 0.015) < 0.006) col += vec3(1.0);
  // clocks drifting along the diagonal
  float s = 1.0 + 0.06*uBass*uReact;
  vec2 o = vec2(0.03*sin(t*0.3), 0.0);
  drawClock(col, p, (vec2(0.0, 0.0) + o)*s, 0.11*s, 0.0, uFlow*0.2, uFlow*1.4, vec3(0.6, 0.9, 1.0),
            vec3(1.0, 0.8, 0.3), vec3(1.0, 0.9, 0.5), 1.0, 1.4);
  drawClock(col, p, (vec2(0.22, 0.2) + o)*s, 0.11*s, 0.3, uFlow*0.25 + 2.0, uFlow*1.1 + 3.0, vec3(1.0, 0.85, 0.4),
            vec3(1.0, 0.85, 0.4), vec3(0.5, 1.0, 0.6), 1.0, 1.4);
  drawClock(col, p, (vec2(-0.2, -0.27) + o)*s, 0.12*s, -0.2, uFlow*0.3 + 4.0, uFlow*1.2 + 1.0, vec3(1.0, 0.9, 0.6),
            vec3(1.0, 0.9, 0.6), vec3(1.0, 0.4, 0.5), 1.0, 1.4);
  drawClock(col, p, (vec2(-0.13, -0.02) + o)*s, 0.04*s, 0.0, 1.0, uFlow*2.0, vec3(0.9), vec3(1.0), vec3(1.0), 0.0, 1.4);
  drawClock(col, p, (vec2(0.14, -0.03) + o)*s, 0.035*s, 0.0, 2.0, uFlow*2.3, vec3(0.9), vec3(1.0), vec3(1.0), 0.0, 1.4);
  // faint radial structure
  float r = length(p);
  float a = atan(p.y, p.x);
  col += vec3(0.25, 0.25, 0.9)*pow(noiseA(a, 14.0, t*0.4), 5.0)*exp(-r*2.0)*1.2*(0.5 + uHigh*uReact);
  return col;
}

vec3 render(vec2 p){
  float t = uTime;
  // LED grid: tall narrow emitters
  vec2 cell = vec2(0.0085, 0.012);
  vec2 gid = floor(p/cell);
  vec2 cc = (gid + 0.5)*cell;
  vec2 f = (p - cc)/cell;
  vec3 c = ledContent(cc, t);
  float l = luma(c);
  float on = smoothstep(0.08, 0.2, l);
  float shape = smoothstep(0.3, 0.22, abs(f.x))*smoothstep(0.47, 0.38, abs(f.y));
  vec3 lit = normalize(c + 1e-4)*1.25*min(l*2.0, 1.4) + 0.15;
  vec3 col = lit*on*shape;
  col += vec3(0.03, 0.03, 0.05)*shape*(1.0 - on);          // unlit LEDs
  col += c*0.08;                                         // bleed glow
  return col;
}
