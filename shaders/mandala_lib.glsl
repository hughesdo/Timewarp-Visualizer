// ---- Chrono Mandala composition (shared by mandala / ink / chalkboard / eclipse) ----
const vec3 SAT[16] = vec3[16](
  vec3(-0.157, 0.338, 0.080), vec3(-0.351, 0.087, 0.120), vec3(-0.408,-0.225, 0.105),
  vec3( 0.203,-0.331, 0.074), vec3( 0.393, 0.179, 0.115), vec3( 0.208, 0.284, 0.085),
  vec3( 0.393,-0.016, 0.054), vec3( 0.382, 0.415, 0.028), vec3(-0.277, 0.246, 0.028),
  vec3( 0.074, 0.374, 0.016), vec3(-0.365,-0.070, 0.016), vec3(-0.539,-0.327, 0.020),
  vec3(-0.243,-0.352, 0.023), vec3(-0.166,-0.344, 0.020), vec3( 0.339,-0.124, 0.018),
  vec3( 0.300,-0.227, 0.015));

vec3 satRim(float h){
  vec3 a = vec3(0.95,0.9,0.85), b = vec3(1.0,0.45,0.6), c = vec3(0.45,0.85,1.0), d = vec3(0.75,0.6,1.0);
  return h < 0.62 ? a : (h < 0.75 ? b : (h < 0.88 ? c : d));
}

// hands helper: slow sweep + snap on snare
void handAngles(float k, float t, out float hA, out float mA){
  float base = hash11(k*9.1 + uSeed*31.0)*TAU;
  mA = base + uFlow*(0.18 + 0.1*hash11(k)) + 0.12*uSnare*uReact;
  hA = base*0.37 + mA/12.0 + 1.3;
}

vec3 mandala(vec2 p, float t, float seed, float var, float heroScale, bool sats, float filAmt){
  vec3 col = vec3(0.0);
  float en = clamp(0.5*uHigh + 0.6*uTreble, 0.0, 1.5)*uReact;

  // filaments behind everything
  vec2 A = vec2(-0.74, -0.58), B = vec2(0.76, 0.56);
  if (filAmt > 0.0){
    col += filaments(p, A, B, 0.2, seed, t, en, 30)*(0.85 + 0.6*uBass*uReact)*filAmt;
    col += filaments(p, A + vec2(0.05, 0.0), B - vec2(0.0, 0.05), 0.09, seed + 0.37, t*1.3, en, 12)*0.6*filAmt;
  }

  // hero dial
  float R = 0.245*heroScale;
  float hA, mA; handAngles(0.0, t, hA, mA);
  float spin = 0.04*sin(t*0.21 + seed*6.0);
  drawClock(col, p, vec2(0.0), R, spin, hA, mA,
            vec3(1.0, 0.32, 0.5), vec3(1.0, 0.94, 0.82), vec3(0.3, 0.85, 1.0),
            2.0, 0.95 + 0.5*uBass*uReact);

  // crystal shards bursting off the ring along the streak
  if (filAmt > 0.0){
    col += shards(p, vec2(0.2, 0.15)*heroScale, 0.62, 0.75, 0.42*heroScale, seed + 0.2, t, en)*0.55*filAmt;
    col += shards(p, vec2(-0.2, -0.15)*heroScale, 0.62 - PI, 0.75, 0.4*heroScale, seed + 0.6, t, en)*0.5*filAmt;
  }
  // satellites
  if (sats){
    for (int i = 0; i < 16; i++){
      vec3 s = SAT[i];
      float fi = float(i);
      float h = hash11(fi*3.7 + 1.0);
      // slow orbit around the hero + per-dial wobble
      float orb = 0.05*sin(t*0.17 + fi) + var*0.15*sin(t*0.09 + fi*0.7);
      vec2 c = rot(orb)*s.xy*heroScale*(1.0 + 0.03*uBass*uReact);
      c += 0.006*vec2(sin(t*0.9 + fi*2.0), cos(t*0.7 + fi*1.3));
      float r = s.z*heroScale*(1.0 + 0.08*uKick*uReact*h);
      float sh, sm; handAngles(fi + 1.0, t, sh, sm);
      vec3 rim = satRim(h);
      vec3 hc = h < 0.5 ? vec3(1.0, 0.9, 0.5) : (h < 0.75 ? vec3(0.5, 1.0, 0.7) : vec3(0.4, 0.9, 1.0));
      drawClock(col, p, c, r, 0.2*sin(t*0.3 + fi), sh, sm, rim, vec3(1.0, 0.95, 0.85), hc,
                r > 0.04 ? 1.0 : 0.0, 0.85 + 0.4*uMid*uReact);
    }
  }

  // a few strands in front (translucent)
  if (filAmt > 0.0)
    col += filaments(p, A + vec2(0.02, 0.03), B + vec2(0.0, -0.02), 0.13, seed + 0.71, t*0.9, en, 8)*0.55*filAmt;

  // dust / sparkle
  col += stars(p + vec2(t*0.003, 0.0), 0.05, t)*0.35*(0.5 + uTreble*uReact);
  return col;
}
