// Scene: EQUATION NEBULA — blue nebula, chalk math writing itself, distant falls over a lake
float mathLayer(vec2 uv, float lod, float reveal){
  // cells of the atlas are 1/8 x 1/4; reveal each cell with a left-to-right write-on
  vec2 cell = floor(uv*vec2(8.0, 4.0));
  float h = hash12(cell);
  float lx = fract(uv.x*8.0);
  float w = clamp((reveal - h*0.6)*2.2, 0.0, 1.0);
  float m = smoothstep(w + 0.02, w - 0.02, lx);
  return chalk(uv, lod)*m;
}

vec3 render(vec2 p){
  float t = uTime, st = uSceneT;
  float bass = uBass*uReact;
  vec3 col = vec3(0.0, 0.004, 0.03);
  // nebula
  vec2 np = p*1.6 + vec2(t*0.015, 0.0);
  float n1 = fbm(np + fbm(np*1.3 + t*0.02)*1.5);
  float n2 = fbm(np*2.3 + 7.0 - t*0.01);
  col += vec3(0.05, 0.12, 0.62)*pow(n1, 2.2)*1.6;
  col += vec3(0.3, 0.06, 0.55)*pow(n2, 3.0)*0.9;
  col += vec3(0.1, 0.3, 1.0)*0.25*exp(-length((p - vec2(0.0, 0.05))*vec2(0.9, 2.2))*2.5)*(0.7 + 0.6*bass);
  col += stars(p, 0.08, t)*0.7;

  // horizon + lake
  float hy = -0.06;
  float mtn = hy + 0.035*fbm3(vec2(p.x*7.0, 3.0))*smoothstep(0.55, 0.0, abs(p.x)) + 0.02*smoothstep(0.25, 0.0, abs(p.x));
  float land = smoothstep(0.003, -0.003, p.y - mtn)*step(hy - 0.01, p.y);
  col = mix(col, vec3(0.01, 0.02, 0.06), land);
  if (p.y < hy){
    // water: darker, reflected sky streaks
    float wy = hy - p.y;
    vec2 rp = vec2(p.x + 0.004*sin(p.y*120.0 + t*2.0), hy + wy);
    col = mix(col, vec3(0.005, 0.015, 0.05) + vec3(0.03, 0.08, 0.3)*pow(fbm(rp*vec2(1.6, 6.0) + t*0.02), 2.0), 0.8);
  }

  // distant falls: dome + wings + glowing stream
  vec2 dc = vec2(0.0, 0.26);
  float R = 0.04;
  vec2 dq = p - dc;
  float dr = length(dq);
  float wing = abs(dq.y + 0.01*sin(dq.x*30.0 + t)) - 0.012*smoothstep(0.32, 0.0, abs(dq.x));
  float wingX = smoothstep(0.3, 0.05, abs(dq.x));
  col += mix(vec3(1.0, 0.3, 0.75), vec3(0.6, 0.4, 1.0), 0.5 + 0.5*sin(dq.x*40.0 + t))*fill(wing)*0.9*wingX;
  col += vec3(1.0, 0.4, 0.8)*0.25*glow(wing, 0.015)*wingX;
  if (dq.y > -0.004){
    col += vec3(1.0, 0.35, 0.8)*stroke(abs(dr - R - 0.008), 0.006)*0.9;
    col = mix(col, vec3(0.0, 0.01, 0.04), fill(dr - R));
  }
  float sw = 0.022 + 0.006*bass;
  float inStream = step(p.y, dc.y)*step(hy, p.y);
  float sx = abs(p.x)/sw;
  float sflow = noise(vec2(p.x*260.0, p.y*12.0 - uFlow*3.0));
  vec3 streamC = mix(vec3(0.15, 0.55, 1.0), vec3(0.75, 0.95, 1.0), sflow);
  streamC = mix(streamC, vec3(0.9, 0.3, 0.8), smoothstep(0.1, 0.25, p.y)*0.6);
  col += streamC*smoothstep(1.0, 0.6, sx)*inStream*(0.9 + 0.7*uMid*uReact);
  col += vec3(0.2, 0.6, 1.0)*0.35*exp(-abs(p.x)/0.04)*inStream;
  // mist where it lands
  col += vec3(0.3, 0.75, 1.0)*0.5*exp(-length((p - vec2(0.0, hy))*vec2(1.0, 3.0))/0.06)*(0.8 + bass);
  // reflection beam
  if (p.y < hy){
    float rx = p.x + 0.006*sin(p.y*90.0 - t*3.0);
    float beam = smoothstep(sw*1.4, sw*0.5, abs(rx));
    float broken = smoothstep(0.35, 0.6, noise(vec2(rx*120.0, p.y*40.0 + t*1.5)));
    col += vec3(0.25, 0.75, 1.0)*beam*(0.45 + 0.4*broken)*smoothstep(-0.6, hy, p.y)*(0.8 + 0.5*bass);
  }
  // moon + orbit ellipse
  vec2 mp = p - vec2(0.0, 0.39);
  col = mix(col, vec3(0.95, 0.9, 0.82), fill(length(mp) - 0.022));
  col += vec3(1.0, 0.9, 0.8)*0.3*glow(length(mp) - 0.022, 0.02);
  vec2 ep = (p - vec2(0.0, 0.36))/vec2(0.045, 0.1);
  col += vec3(0.95, 0.92, 0.85)*stroke(abs(length(ep) - 1.0)*0.05, 0.0012)*0.8;

  // chalk math, three parallax layers
  float reveal = st*0.35 + 0.15;
  float hi = 0.6 + 0.8*uHigh*uReact;
  vec2 u1 = p*0.42 + vec2(t*0.006 + uSeed, 0.13);
  vec2 u2 = p*0.62 + vec2(-t*0.01 + 0.31, 0.57 + uSeed);
  vec2 u3 = p*0.22 + vec2(t*0.012 + 0.7, 0.2);
  float m1 = mathLayer(u1, 0.6, reveal);
  float m2 = mathLayer(u2, 0.4, reveal - 0.3);
  float m3 = mathLayer(u3, 2.8, reveal + 0.2);
  col += vec3(0.85, 0.9, 1.0)*m1*0.75*hi;
  col += vec3(0.65, 0.75, 1.0)*m2*0.35*hi;
  col += vec3(0.8, 0.85, 1.0)*m3*0.22*(0.6 + 0.6*uSnare*uReact);
  return col;
}
