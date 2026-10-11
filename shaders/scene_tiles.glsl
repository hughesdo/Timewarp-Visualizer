// Scene: ECLIPSE TILES — kaleidoscopic tiling of eclipse dials, cyan/orange alternating columns
vec3 render(vec2 p){
  float t = uTime;
  float W = 0.6, H = 0.34;
  float scroll = uFlow*0.08*(uVar > 0.5 ? -1.0 : 1.0);
  float ci = floor((p.x + W*0.5)/W);
  float lx = p.x - ci*W;
  float yy = p.y + scroll*(mod(ci, 2.0) < 0.5 ? 1.0 : -1.0);
  float ri = floor((yy + H*0.5)/H);
  float ly = yy - ri*H;
  vec2 lp = vec2(lx, ly);
  // mirror alternate tiles (kaleidoscope)
  if (mod(ri, 2.0) > 0.5) lp.y = -lp.y;
  if (mod(ci, 2.0) > 0.5) lp.x = -lp.x;
  bool center = abs(ci) < 0.5;
  float soft = center ? 0.0 : 1.0;
  float Rr = 0.155*(1.0 + 0.05*uBass*uReact);
  vec3 c = eclipse(lp, Rr, t + ci*0.7, soft, uSeed + ri*0.13, center ? 1.0 : 0.5);
  if (!center){
    float l = luma(c);
    c = vec3(0.12, 0.55, 1.0)*l*1.05 + vec3(0.0, 0.04, 0.08)*l;
  } else if (mod(ri, 2.0) > 0.5){
    c = c.zyx*vec3(0.6, 0.8, 1.6);   // cyan-shifted center row for rhythm
  }
  // column gutters
  c *= smoothstep(0.0, 0.03, W*0.5 - abs(lx));
  return c*(0.9 + 0.3*uKick*uReact);
}
