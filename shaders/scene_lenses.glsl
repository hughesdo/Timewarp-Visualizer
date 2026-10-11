// Scene: TWIN LENSES — chrome goggle lenses holding spiral galaxies, horizontal mirror smear
vec3 galaxy(vec2 p, float t, float seed){
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float spin = uFlow*0.25 + seed*6.0;
  float arms = 0.5 + 0.5*sin(2.0*(a - spin) - log(r)*4.5);
  arms = pow(arms, 3.0);
  float dust = fbm(p*9.0 + vec2(spin*0.3, 0.0));
  vec3 col = vec3(0.01, 0.03, 0.12) + vec3(0.03, 0.08, 0.3)*smoothstep(1.0, 0.0, r);
  col += vec3(0.45, 0.6, 1.0)*arms*exp(-r*2.2)*(0.5 + 0.8*dust);
  col += vec3(1.0, 0.55, 0.45)*exp(-r*9.0)*(1.0 + 0.8*uBass*uReact);
  col += vec3(1.0, 0.85, 0.7)*exp(-r*25.0);
  col += vec3(0.9, 0.3, 0.55)*pow(dust, 4.0)*arms*0.8*exp(-r*3.0);
  col += stars(p*0.7 + seed, 0.12, t)*1.2*(0.5 + uTreble*uReact);
  return col;
}

vec3 lensPair(vec2 p, float t){
  vec3 col = vec3(0.0);
  float bass = uBass*uReact;
  float R = 0.145*(1.0 + 0.04*bass + 0.03*uKick*uReact);
  for (int i = 0; i < 2; i++){
    float sx = i == 0 ? -1.0 : 1.0;
    vec2 c = vec2(sx*0.165, -0.02);
    vec2 q = p - c;
    float r = length(q);
    if (r < R*1.35){
      if (r < R){
        // galaxy seen through a slightly fish-eyed lens
        vec2 gq = q/R;
        gq *= 1.0 + 0.35*dot(gq, gq);
        col = galaxy(gq*0.8 + vec2(sx*0.12, 0.04), t, uSeed + float(i)*0.5);
        // curved reflection highlight
        float hl = stroke(abs(length(q - vec2(-0.03, 0.035)) - R*0.78), 0.004)*smoothstep(0.0, 0.08, q.y + 0.03)*smoothstep(0.1, -0.05, q.x);
        col += vec3(0.9, 0.95, 1.0)*hl*0.6;
        col *= 1.0 - 0.5*smoothstep(R*0.7, R, r);
      }
      // chrome rims
      col += vec3(0.95, 0.97, 1.0)*stroke(abs(r - R), 0.008);
      col += vec3(0.55, 0.6, 0.7)*stroke(abs(r - R - 0.016), 0.004);
      col += vec3(0.85, 0.9, 1.0)*stroke(abs(r - R - 0.028), 0.0025);
      col += vec3(0.4, 0.6, 1.0)*0.4*glow(abs(r - R - 0.016), 0.012);
    }
  }
  // bridge + straps
  float br = abs(length(p - vec2(0.0, -0.065)) - 0.07) - 0.006;
  col += vec3(0.95)*fill(br)*step(0.0, p.y + 0.02)*step(abs(p.x), 0.04);
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    float yk = -0.02 + (fk - 1.0)*0.03 + 0.004*sin(abs(p.x)*25.0 + t*2.0 + fk);
    float strap = abs(p.y - yk - 0.06*(abs(p.x) - 0.33)*(abs(p.x) - 0.33)) - 0.002;
    col += vec3(0.9, 0.92, 1.0)*stroke(strap, 0.0012)*step(0.32, abs(p.x))*smoothstep(0.75, 0.4, abs(p.x));
  }
  // halo arc above
  float ha = abs(length((p - vec2(0.0, -0.05))*vec2(1.0, 1.6)) - 0.36);
  col += vec3(0.85, 0.9, 1.0)*stroke(ha, 0.003)*smoothstep(0.05, 0.12, p.y)*0.8;
  col += vec3(0.85, 0.9, 1.0)*0.15*glow(ha, 0.02)*smoothstep(0.05, 0.12, p.y);
  return col;
}

vec3 render(vec2 p){
  float t = uTime;
  vec3 col = vec3(0.0);
  float ax = abs(p.x);
  float edge = 0.36;
  vec3 center = ax < 0.46 ? lensPair(p, t) : vec3(0.0);
  if (ax < edge){
    col = center;
  } else {
    // mirror smear: compressed echoes of the centre, blurred horizontally
    vec3 acc = vec3(0.0);
    for (int k = 0; k < 6; k++){
      float o = float(k)*0.012;
      float xr = edge - (ax - edge)*0.55 - o - 0.06*fract(uFlow*0.3);
      acc += lensPair(vec2(sign(p.x)*xr, p.y*(1.0 + (ax - edge)*0.6)), t);
    }
    col = acc/6.0*vec3(0.55, 0.6, 0.75)*smoothstep(0.95, 0.45, ax)*(0.8 + 0.5*uMid*uReact);
    col = mix(center, max(col, center*0.6), smoothstep(edge, 0.46, ax));
  }
  // horizontal speed streaks
  float row = floor(p.y*90.0);
  float hs = hash11(row + floor(uFlow*2.0));
  float str = smoothstep(0.92, 1.0, hs)*smoothstep(0.25, 0.7, ax)*(0.3 + uHat*uReact);
  col += vec3(0.7, 0.75, 0.9)*str*0.25;
  return col;
}
