// Scene: STARBURST — volumetric radial rays from a cluster of small clocks
vec3 render(vec2 p){
  float t = uTime;
  float bass = uBass*uReact, hi = uHigh*uReact, kick = uKick*uReact;
  vec2 c = vec2(0.0, 0.02);
  vec2 q = p - c;
  float r = length(q) + 1e-4;
  float a = atan(q.y, q.x);
  vec3 col = vec3(0.006, 0.006, 0.03);

  // turbulent filaments (radial)
  float n = fbmA(a, 6.0/PI, log(r)*4.0 - uFlow*0.4);
  float fil = pow(1.0 - abs(n*2.0 - 1.0), 9.0);
  col += vec3(0.35, 0.2, 0.75)*fil*0.16*smoothstep(0.05, 0.25, r);
  float n3 = fbmA(a, 14.0/PI, log(r)*7.0 - uFlow*0.6 + 4.0);
  col += vec3(0.8, 0.3, 0.8)*pow(1.0 - abs(n3*2.0 - 1.0), 16.0)*0.15*smoothstep(0.1, 0.35, r);

  // rays
  float ra = noiseA(a, 9.0, t*0.25);
  float rb = noiseA(a, 26.0, t*0.5 + uFlow*0.2 + 3.0);
  float rc = noiseA(a, 60.0, t*0.9 + 9.0);
  float ray = pow(ra, 3.0)*0.9 + pow(rb, 4.0)*0.8 + pow(rc, 6.0)*0.6*(0.5 + hi);
  float reach = 0.35 + 0.35*bass + 0.15*kick;
  float fall = exp(-r/reach);
  col += vec3(0.45, 0.5, 1.0)*ray*fall*1.1*smoothstep(0.02, 0.12, r);
  col += vec3(0.85, 0.8, 1.0)*pow(ray, 2.0)*fall*fall*0.9;
  col += vec3(0.5, 0.45, 1.0)*0.35*exp(-r*7.0)*(1.0 + kick);

  // clock cluster along a diagonal
  float s = 1.0 + 0.04*bass;
  drawClock(col, q, vec2(0.0, 0.0)*s, 0.105*s, 0.0, uFlow*0.2 + 1.0, uFlow*1.3 + 2.0,
            vec3(0.75, 0.85, 1.0), vec3(1.0, 0.8, 0.35), vec3(0.4, 0.85, 1.0), 1.0, 1.1);
  drawClock(col, q, vec2(-0.15, -0.2)*s, 0.095*s, 0.3, uFlow*0.25 + 4.0, uFlow*1.1 + 1.0,
            vec3(1.0, 0.3, 0.55), vec3(1.0, 0.8, 0.35), vec3(1.0, 0.9, 0.6), 1.0, 1.0);
  drawClock(col, q, vec2(0.085, 0.13)*s, 0.055*s, -0.4, uFlow*0.3 + 2.0, uFlow*1.6 + 5.0,
            vec3(1.0, 0.85, 0.4), vec3(1.0, 0.85, 0.4), vec3(1.0, 0.9, 0.5), 1.0, 1.0);
  drawClock(col, q, vec2(0.025, 0.14)*s, 0.035*s, 0.2, 3.0, uFlow*2.0, vec3(0.9, 0.9, 1.0),
            vec3(1.0, 0.85, 0.5), vec3(1.0), 0.0, 0.9);
  drawClock(col, q, vec2(0.135, -0.02)*s, 0.028*s, 0.0, 5.0, uFlow*2.2 + 1.0, vec3(0.8, 0.85, 1.0),
            vec3(1.0), vec3(1.0), 0.0, 0.9);
  col += shards(q, vec2(-0.03, -0.12), -PI*0.3, 0.5, 0.18, uSeed, t, bass)*0.8;
  col += shards(q, vec2(0.0, 0.1), PI*0.45, 0.4, 0.14, uSeed + 0.3, t, bass)*0.6;
  return col;
}
