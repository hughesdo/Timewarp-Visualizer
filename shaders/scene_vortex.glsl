// Scene: CLOCK VORTEX — indigo spiral vortex, clocks spiraling inward, crystal shard fans
vec3 vortexBG(vec2 p, float t){
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float lr = log(r);
  // twisted fabric: ridged noise in log-spiral space (angle-periodic)
  float sh = lr*2.2 - uFlow*0.35;
  float y1 = (lr*3.0 - uFlow*0.5)*1.4 + t*0.05;
  float n = fbmA(mod(a + sh + PI, TAU) - PI, 6.0/PI, y1);
  float ridge = pow(1.0 - abs(n*2.0 - 1.0), 6.0);
  float n2 = fbmA(mod(a + sh + PI, TAU) - PI, 15.0/PI, (lr*3.0 - uFlow*0.5)*3.0 + 3.0);
  float ridge2 = pow(1.0 - abs(n2*2.0 - 1.0), 10.0);
  vec3 col = vec3(0.012, 0.01, 0.035);
  col += vec3(0.16, 0.1, 0.42)*ridge*(0.45 + 0.5*uLowMid*uReact);
  col += vec3(0.75, 0.3, 0.9)*ridge2*0.28;
  // ripples
  col += vec3(0.25, 0.2, 0.6)*0.12*pow(0.5 + 0.5*sin(lr*18.0 - uFlow*2.0 + a*2.0), 8.0)*smoothstep(0.02, 0.2, r);
  col *= smoothstep(0.0, 0.18, r)*0.7 + 0.3;
  return col;
}

vec3 render(vec2 p){
  float t = uTime;
  float bass = uBass*uReact, kick = uKick*uReact;
  vec2 c = vec2(0.04*sin(t*0.23 + uSeed*4.0), 0.03*cos(t*0.19));
  vec2 q = (p - c)*(1.0 - 0.03*kick);
  if (uVar > 0.5) q.x = -q.x;
  vec3 col = vortexBG(q, t);

  // large pink arc
  float r0 = length(q - vec2(-0.1, 0.05));
  col += vec3(1.0, 0.2, 0.55)*stroke(abs(r0 - 0.78), 0.0025)*smoothstep(-0.2, 0.4, q.x)*0.8;

  // shard fans
  col += shards(q, vec2(-0.12, 0.0), PI*0.98, 0.9, 0.55, uSeed, t, bass)*0.9;
  col += shards(q, vec2(0.18, 0.06), PI*0.15, 0.8, 0.45, uSeed + 0.4, t, bass)*0.8;
  col += shards(q, vec2(0.05, -0.2), -PI*0.35, 0.7, 0.3, uSeed + 0.7, t, bass)*0.6;

  // clocks spiraling inward (respawn at the edge)
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    float h = hash11(fi*5.31 + uSeed*3.0);
    float life = fract(h + uFlow*0.045 + fi*0.111);
    float rho = mix(0.95, 0.08, life);
    float th = h*TAU + uFlow*(0.25 + 0.2*h) + life*2.5;
    vec2 cp = rho*vec2(cos(th), sin(th)*0.75);
    float R = mix(0.03, 0.2, smoothstep(0.05, 0.9, rho));
    float fade = smoothstep(0.0, 0.08, life)*smoothstep(1.0, 0.85, life);
    vec3 rim = h < 0.33 ? vec3(0.95, 0.9, 1.0) : (h < 0.66 ? vec3(1.0, 0.5, 0.75) : vec3(0.6, 0.85, 1.0));
    float hA, mA; hA = h*20.0 + uFlow*0.2; mA = h*50.0 + uFlow*1.2;
    vec3 tmp = col;
    drawClock(tmp, q, cp, R, th*0.3, hA, mA, rim, vec3(1.0, 0.92, 0.55),
              h > 0.5 ? vec3(0.4, 1.0, 0.6) : vec3(1.0, 0.95, 0.9), R > 0.05 ? 1.0 : 0.0, 0.9 + 0.4*uMid*uReact);
    col = mix(col, tmp, fade);
  }
  // hero clock at the eye
  float hh = 0.0;
  float hA = uFlow*0.15 + uSeed*9.0, mA = uFlow*1.0 + uSeed*20.0;
  drawClock(col, q, vec2(0.0), 0.16*(1.0 + 0.05*bass), 0.0, hA, mA, vec3(0.45, 0.9, 1.0), vec3(1.0, 0.88, 0.45),
            vec3(0.4, 0.8, 1.0), 1.0, 1.0 + 0.3*bass);
  return col;
}
