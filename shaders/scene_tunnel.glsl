// Scene: CLOCK TUNNEL — flying through a tunnel lined with clocks, warp speed lines
vec3 render(vec2 p){
  float t = uTime;
  float bass = uBass*uReact, kick = uKick*uReact;
  vec2 c = vec2(0.03*sin(t*0.43 + uSeed*5.0), 0.025*cos(t*0.31));
  vec2 q = p - c;
  q = rot(0.15*sin(t*0.2) + uVar*0.6 + uFlow*0.05)*q;
  float r = length(q);
  float a = atan(q.y, q.x);
  float travel = uFlow*1.25 + t*0.25;
  float z = 0.22/max(r, 0.002);
  float zz = z + travel;
  float fog = smoothstep(0.02, 0.32, r);

  vec3 col = vec3(0.012, 0.008, 0.025)*fog;
  // tunnel wall shading + faint ring structure
  float rid = floor(zz*1.4);
  float rf = fract(zz*1.4);
  col += irid(rid*0.17 + t*0.02)*glow(abs(rf - 0.5), 0.015)*0.12*fog;
  col += vec3(0.05, 0.04, 0.12)*fbmA(a, 3.0, zz*2.0)*fog;
  // big chromatic lens rings
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float rr = 0.35 + 0.18*fi + 0.04*sin(t*0.5 + fi);
    float arcM = smoothstep(-0.3, 0.6, sin(a*1.0 + fi*2.1 + t*0.3));
    col += irid(a*0.15 + fi*0.3 + 0.2)*glow(abs(r - rr), 0.004 + 0.003*fi)*0.35*arcM;
  }

  // clocks on the walls: cells in (angle, depth)
  const float NA = 7.0;
  float sa = (a/TAU + 0.5)*NA;
  for (int k = 0; k < 2; k++){
    float zs = 1.1;
    float sz = zz/zs + float(k)*0.5;
    float iz = floor(sz);
    float ia = floor(sa + mod(iz, 2.0)*0.5);
    float h = hash12(vec2(ia, iz) + float(k)*31.0);
    if (h < 0.4) continue;
    float fa = fract(sa + mod(iz, 2.0)*0.5);
    float fz = fract(sz);
    // local uv: angle -> u, depth -> v (perspective squash comes for free)
    vec2 lp = vec2((fa - 0.5)*TAU/NA*1.2, (fz - 0.5)*zs*1.05);
    vec2 jit = (hash22(vec2(ia, iz)) - 0.5)*0.12;
    float R = 0.17 + 0.07*hash11(h*13.0);
    float depthFade = smoothstep(9.0, 2.0, z) ;
    vec3 rim = mix(vec3(1.0, 0.8, 0.35), irid(h), 0.35);
    float hA = h*TAU + uFlow*0.4, mA = h*40.0 + uFlow*2.0;
    vec3 tmp = col;
    drawClock(tmp, lp, jit, R, h*6.0, hA, mA, rim, vec3(1.0, 0.85, 0.5),
              hash11(h*3.0) > 0.5 ? vec3(0.3, 0.8, 1.0) : vec3(1.0, 0.3, 0.3), 1.0, 1.0);
    col = mix(col, tmp, depthFade*fog);
  }

  // warp speed lines (thin, colored)
  float NL = 140.0;
  float la = (a/TAU + 0.5)*NL;
  float li = floor(la);
  float lh = hash11(li*1.7);
  float ld = abs(fract(la) - 0.5)*TAU/NL*r;
  float sp = fract(log(r)*1.2 - t*(1.2 + 2.5*bass) + lh*7.0);
  float streak = smoothstep(0.0, 0.08, sp)*smoothstep(0.45, 0.1, sp);
  vec3 lc = lh > 0.8 ? vec3(0.4, 1.0, 0.6) : (lh > 0.6 ? vec3(0.5, 0.6, 1.0) : (lh > 0.5 ? vec3(1.0, 0.4, 0.7) : vec3(0.9)));
  col += lc*stroke(ld, 0.0006 + 0.002*r)*streak*step(0.35, lh)*smoothstep(0.08, 0.3, r)*(0.8 + uHigh*uReact);

  // manga speed wedges from the frame edge (snare)
  float NW = 46.0;
  float wa = (a/TAU + 0.5)*NW + floor(t*6.0)*0.37;
  float wi = floor(wa);
  float wh = hash11(wi*3.3 + floor(t*6.0));
  float wd = abs(fract(wa) - 0.5);
  float wlen = 0.45 + 0.3*wh - 0.25*uSnare*uReact;
  float wedge = smoothstep(0.08*(r - wlen)/0.5, 0.0, wd)*step(wlen, r)*step(0.55, wh);
  col += vec3(0.95, 0.95, 1.0)*wedge*(0.4 + 0.8*uSnare*uReact);

  // center glow
  col += vec3(0.5, 0.45, 0.9)*0.15*exp(-r*9.0)*(1.0 + kick);
  return col;
}
