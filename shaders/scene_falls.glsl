// Scene: PORTAL FALLS — black dome portal, swirl wings, twin neon curtains, cyan splash
vec3 fallsPal(float s){
  // navy -> violet -> magenta -> pink -> cyan -> white
  vec3 c = mix(vec3(0.05,0.03,0.18), vec3(0.45,0.12,0.6), smoothstep(0.15,0.4,s));
  c = mix(c, vec3(1.0,0.2,0.62), smoothstep(0.4,0.6,s));
  c = mix(c, vec3(0.35,0.9,1.0), smoothstep(0.68,0.82,s));
  c = mix(c, vec3(1.0,0.95,1.0), smoothstep(0.9,1.0,s));
  return c;
}

vec3 render(vec2 p){
  float t = uTime, f = uFlow;
  float bass = uBass*uReact, kick = uKick*uReact;
  p *= 1.0 - 0.025*kick;
  if (uVar > 0.6) p.x = -p.x;
  vec3 col = vec3(0.02, 0.008, 0.035);

  // ---- background: stars, magenta horizon glow, dark rocks, blue crystals
  col += stars(p, 0.06, t)*0.6;
  float hz = smoothstep(-0.05, -0.5, p.y);
  col += vec3(1.0, 0.15, 0.45)*hz*(0.32 + 0.25*bass)*(0.7 + 0.3*fbm3(vec2(p.x*3.0 + t*0.1, p.y*2.0)));
  col += vec3(0.8, 0.1, 0.6)*0.25*exp(-abs(p.y + 0.12)/0.015)*smoothstep(0.9, 0.2, abs(p.x)); // thin horizon line
  float rock = -0.42 + 0.12*fbm3(vec2(p.x*4.0, 1.0)) + 0.18*smoothstep(0.45, 0.85, abs(p.x));
  col = mix(col, vec3(0.02, 0.01, 0.03), smoothstep(0.004, -0.004, p.y - rock)*smoothstep(0.35, 0.55, abs(p.x)));
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 hc = vec2((i < 2 ? -1.0 : 1.0)*(0.74 + 0.04*fi), (mod(fi, 2.0) < 0.5 ? 0.46 : 0.0) + 0.02*sin(t*0.3 + fi));
    vec2 hq = rot(0.3*fi + t*0.05)*(p - hc);
    float hd = sdHex(hq, 0.07 + 0.02*fi);
    float hg = 0.5 + 0.5*dot(normalize(hq + 1e-4), vec2(0.7, 0.7));
    col = mix(col, mix(vec3(0.12, 0.16, 0.35), vec3(0.35, 0.45, 0.8), hg)*0.6, fill(hd)*0.35);
    col += vec3(0.5, 0.65, 1.0)*0.18*stroke(abs(hd), 0.0015);
  }

  // ---- geometry
  vec2 dc = vec2(-0.03, 0.225);               // dome base center
  float R = 0.205;
  float spread = clamp(0.6*smoothstep(0.15, 1.0, 0.5 - 0.5*cos(uSceneT*0.32 + uSeed*3.0)) + 0.25*bass, 0.0, 1.0);
  float y01 = clamp((dc.y - p.y)/(dc.y + 0.5), 0.0, 1.0);   // 0 top of falls, 1 bottom of frame
  float dx = p.x - dc.x;
  float wo = 0.2 + 0.035*y01 + spread*0.42*pow(y01, 2.2);
  float wi = (0.045 + 0.03*y01)*(1.0 - spread*0.85);

  // ---- swirl wings (behind the falls)
  float wy = dc.y + 0.008 + 0.012*sin(p.x*7.0 + t*0.6);
  float th = 0.055*(1.0 - smoothstep(0.12, 0.95, abs(dx))) + 0.012 + 0.03*smoothstep(0.35, 0.0, abs(dx));
  vec2 wq = vec2(dx, p.y - wy);
  float warp = fbm(vec2(dx*4.0 - sign(dx)*f*0.25, wq.y*10.0) + vec2(0.0, t*0.1));
  float wingD = abs(wq.y + 0.025*(warp - 0.5)) - th;
  float wingM = fill(wingD);
  float stri = fbm(vec2(abs(dx)*6.0 - f*0.35, wq.y*38.0 + warp*3.0));
  vec3 wingC = mix(vec3(0.35, 0.05, 0.3), vec3(0.95, 0.15, 0.55), smoothstep(0.3, 0.5, stri));
  wingC = mix(wingC, vec3(1.0, 0.55, 0.8), smoothstep(0.6, 0.75, stri));
  wingC = mix(wingC, vec3(0.3, 0.85, 1.0), smoothstep(0.62, 0.8, fbm3(vec2(abs(dx)*9.0 - f*0.5, wq.y*25.0))));
  float curl = fbm3(vec2(abs(dx)*5.0 + warp*2.0 - f*0.2, wq.y*14.0 - warp*3.0));
  wingC = mix(wingC, vec3(0.08, 0.04, 0.2), smoothstep(0.42, 0.3, curl)*0.85);
  wingC += vec3(1.0, 0.75, 0.3)*stroke(abs(curl - 0.36), 0.012)*0.0 + vec3(1.0, 0.7, 0.3)*smoothstep(0.02, 0.0, abs(curl - 0.43))*0.35;
  col = mix(col, wingC*(0.85 + 0.4*uMid*uReact), wingM);
  col += vec3(1.0, 0.75, 0.2)*stroke(abs(wingD), 0.0022)*1.1;   // gold outline
  col += vec3(1.0, 0.3, 0.6)*0.25*glow(wingD, 0.02);
  // curls hanging under the wings
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float sx = (i < 2 ? -1.0 : 1.0)*(0.27 + 0.13*mod(fi, 2.0));
    vec2 cc = vec2(dc.x + sx, dc.y - 0.07 - 0.03*mod(fi, 2.0));
    vec2 cq = p - cc;
    float cr = length(cq);
    if (cr < 0.07){
      float ca = atan(cq.y, cq.x)*sign(sx) + t*0.4;
      float sp = abs(fract((cr - ca*0.012)/0.024) - 0.5)*0.024;
      float m = smoothstep(0.065, 0.03, cr);
      col = mix(col, vec3(0.85, 0.15, 0.5), m*0.6);
      col += vec3(1.0, 0.75, 0.25)*stroke(sp, 0.0016)*m*1.2;
    }
  }

  // ---- dome rim (swirling band) + black portal
  vec2 dq = p - dc;
  float dr = length(dq);
  float da = atan(dq.y, dq.x);
  float rimW = 0.048 + 0.003*sin(da*9.0 + t);
  if (dq.y > -0.02){
    float band = smoothstep(R - 0.002, R + 0.002, dr)*smoothstep(R + rimW + 0.003, R + rimW - 0.003, dr);
    float fl = fbm(vec2(da*7.0 + f*0.3, (dr - R)*45.0 - t*0.4));
    vec3 rc = mix(vec3(0.3, 0.2, 0.75), vec3(0.95, 0.2, 0.6), smoothstep(0.38, 0.5, fl));
    rc = mix(rc, vec3(0.3, 0.85, 1.0), smoothstep(0.55, 0.66, fl));
    rc = mix(rc, vec3(0.45, 0.5, 1.0), smoothstep(0.68, 0.8, fl));
    col = mix(col, rc*(0.9 + 0.8*kick), band*smoothstep(-0.02, 0.01, dq.y));
    col += vec3(1.0, 0.75, 0.25)*stroke(abs(dr - R - rimW), 0.0022)*smoothstep(-0.02, 0.02, dq.y);
    col += vec3(1.0, 0.4, 0.7)*0.4*glow(abs(dr - R - rimW), 0.02)*smoothstep(-0.02, 0.02, dq.y)*(1.0 + kick);
  }
  float dome = fill(dr - R)*smoothstep(-0.003, 0.003, dq.y);
  col = mix(col, vec3(0.0), dome);
  col += vec3(0.4, 0.8, 1.0)*0.5*stroke(abs(dr - R), 0.0015)*smoothstep(0.0, 0.01, dq.y);

  // ---- curtains
  if (p.y < dc.y + 0.004){
    float adx = abs(dx);
    float cm = smoothstep(wo + 0.004, wo - 0.004, adx)*smoothstep(wi - 0.004, wi + 0.004, adx);
    float xn = (adx - wi)/max(wo - wi, 0.01);
    float side = sign(dx);
    float flow = f*1.6 + t*0.4;
    float s = fbm(vec2(xn*14.0 + side*7.0, y01*2.2 - flow));
    s = 0.6*s + 0.55*noise(vec2(xn*55.0 + side*3.0, y01*5.0 - flow*1.6));
    s = s*1.25 - 0.32;
    float hl = pow(noise(vec2(xn*90.0, y01*3.0 - flow*2.2)), 6.0)*2.0;
    vec3 cc = fallsPal(clamp(s + hl*0.4 + 0.1*uMid*uReact, 0.0, 1.0));
    cc *= 0.75 + 0.45*smoothstep(0.0, 0.25, xn) + 0.3*uHigh*uReact;
    cc += vec3(1.0, 0.85, 1.0)*hl*0.5;
    col = mix(col, cc, cm);
    float edge = min(abs(adx - wo), wi > 0.004 ? abs(adx - wi) : 1.0);
    col += mix(vec3(0.3, 0.9, 1.0), vec3(1.0, 0.3, 0.7), step(0.0, side))*0.9*stroke(edge, 0.0018)*smoothstep(0.0, 0.05, y01);
    col += vec3(0.6, 0.3, 1.0)*0.12*glow(adx - wo, 0.03);
  }

  // ---- splash at the base
  float baseW = wo + 0.12 + 0.1*bass;
  float sx = dx/baseW;
  if (abs(sx) < 1.3){
    float jets = pow(noise(vec2(dx*38.0, t*1.6)), 2.5)*0.12 + pow(noise(vec2(dx*90.0 + 4.0, t*3.0)), 4.0)*0.11;
    float h = (0.035 + 0.07*bass + 0.06*kick + jets*(0.45 + 0.8*bass))*smoothstep(1.3, 0.4, abs(sx));
    float top = -0.5 + h;
    float fz = fbm(vec2(dx*25.0, p.y*18.0 - t*2.5));
    float m = smoothstep(0.012, -0.012, p.y - top + (fz - 0.5)*0.07);
    vec3 sc = mix(vec3(0.25, 0.75, 1.0), vec3(0.8, 1.0, 1.0), smoothstep(0.5, 0.75, fz));
    sc = mix(sc, vec3(1.0, 0.35, 0.7), smoothstep(0.62, 0.8, fbm3(vec2(dx*12.0, p.y*8.0 + t))));
    col = mix(col, sc*(0.8 + 0.6*uHigh*uReact), m*0.95);
    col += vec3(0.4, 0.9, 1.0)*0.25*glow(p.y - top, 0.03)*smoothstep(1.2, 0.2, abs(sx));
  }

  // ---- droplets
  for (int l = 0; l < 2; l++){
    float sc = 22.0 + 14.0*float(l);
    vec2 g = vec2(p.x*sc, (p.y + t*(0.05 + 0.03*float(l)))*sc);
    vec2 id = floor(g), fr = fract(g) - 0.5;
    float h = hash12(id + float(l)*11.0);
    float zone = smoothstep(0.55, 0.15, abs(p.y - 0.12))*smoothstep(0.75, 0.25, abs(dx)) + smoothstep(-0.25, -0.45, p.y)*0.6;
    if (h > 0.955){
      vec2 o = (hash22(id) - 0.5)*0.6;
      float d = length(fr - o) - (0.07 + 0.1*hash11(h*9.0));
      vec3 dcol = hash11(h*71.0) > 0.7 ? vec3(1.0, 0.85, 0.3) : vec3(0.4, 0.9, 1.0);
      col += dcol*(fill(d*0.6/sc*sc)*0.5 + 0.6*stroke(abs(d), 0.03))*zone*(0.6 + uTreble*uReact);
    }
  }

  // mist & vignette
  col += vec3(0.5, 0.4, 0.9)*0.08*fbm3(vec2(p.x*2.0 + t*0.05, p.y*3.0))*smoothstep(0.1, -0.4, p.y);
  return col;
}
