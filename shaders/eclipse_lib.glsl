// ---- Eclipse ring composition (shared by eclipse / tiles) ----
// p: local coords, ring radius Rr; soft >0 gives the blurred look used in tile side columns
vec3 eclipse(vec2 p, float Rr, float t, float soft, float seed, float detail){
  float bass = uBass*uReact, hi = (uHigh + uTreble)*0.5*uReact;
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  float R = Rr*(1.0 + 0.03*bass + 0.02*uKick*uReact);
  float w = 0.012*Rr/0.36 + soft*0.02;
  // corona wisps outside the ring
  float side = 0.6 + 0.4*sin(a*1.0 + 2.2 + seed*6.0);
  float wisp = fbmA(a, 7.0, (r - R)*10.0/Rr*0.36 - t*0.35 + seed*10.0);
  wisp = pow(wisp, 2.0)*side*exp(-max(r - R, 0.0)/(0.07*Rr/0.36 + soft*0.04))*step(R*0.97, r);
  vec3 warm = vec3(1.0, 0.62, 0.38);
  col += warm*wisp*(1.1 + 1.2*hi);
  // ring: hot core + peach halo
  float d = r - R;
  col += vec3(1.0, 0.92, 0.82)*exp(-pow(d/w, 2.0))*(1.1 + 0.6*bass);
  col += warm*exp(-abs(d)/(0.03*Rr/0.36 + soft*0.03))*0.75;
  col += vec3(0.9, 0.35, 0.15)*exp(-abs(d)/(0.1*Rr/0.36 + soft*0.05))*0.3;
  // dark disk inside
  col *= mix(1.0, 0.0, smoothstep(R - w*1.5, R - w*3.5, r)*0.85);

  if (detail > 0.0){
    float s = Rr/0.36;
    float en = clamp(0.5*uHigh + 0.6*uTreble, 0.0, 1.5)*uReact;
    // iridescent shards curling around the dial
    col += filaments(p, vec2(-0.2, -0.17)*s, vec2(0.22, 0.17)*s, 0.13*s, seed, t, en, 12)*0.6;
    float hA = uFlow*0.15 + seed*7.0, mA = uFlow*1.0 + seed*11.0;
    drawClock(col, p, vec2(0.0), 0.19*s, 0.0, hA, mA, vec3(0.3, 0.95, 0.8), vec3(1.0, 0.92, 0.75),
              vec3(0.35, 0.85, 1.0), detail > 1.0 ? 1.0 : 0.0, 1.0 + 0.3*bass);
    col += shards(p, vec2(0.1, 0.09)*s, PI*0.25, 1.1, 0.24*s, seed, t, en)*0.9;
    col += shards(p, vec2(-0.1, -0.08)*s, -PI*0.78, 1.1, 0.22*s, seed + 0.5, t, en)*0.8;
    // teal outer bezel
    col += vec3(0.2, 0.9, 0.8)*stroke(abs(r - 0.205*s), 0.004*s)*0.8;
    col += vec3(0.9, 0.3, 0.8)*stroke(abs(r - 0.218*s), 0.002*s)*0.6;
  }
  return col;
}
