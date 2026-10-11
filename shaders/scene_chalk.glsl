// Scene: CHALKBOARD MANDALA — the dial over a blackboard of formulas and geometry
float chalkLine(vec2 p, vec2 a, vec2 b, float w){
  float d = sdSeg(p, a, b);
  float grain = 0.6 + 0.4*noise(p*400.0);
  return stroke(d, w)*grain;
}

vec3 render(vec2 p){
  float t = uTime;
  vec3 col = vec3(0.006, 0.006, 0.01);
  // blackboard formulas: sharp mid layer + huge blurred foreground layer
  vec2 u1 = p*0.5 + vec2(t*0.004 + uSeed, 0.27);
  vec2 u2 = p*0.16 + vec2(-t*0.006 + 0.4 + uSeed, 0.1);
  float hi = 0.6 + 0.8*uHigh*uReact;
  col += vec3(0.85, 0.87, 0.9)*chalk(u1, 0.3)*0.5*hi;
  col += vec3(0.9)*chalk(u2, 3.2)*0.35*(0.5 + 0.8*uSnare*uReact);
  // chalk geometry: triangle, axis, dashed line, parabola
  vec2 gp = rot(0.08*sin(t*0.1))*p;
  float L = 0.0;
  L += chalkLine(gp, vec2(-0.05, 0.45), vec2(-0.25, -0.5), 0.0016);
  L += chalkLine(gp, vec2(-0.05, 0.45), vec2(0.35, -0.48), 0.0016);
  L += chalkLine(gp, vec2(-0.8, -0.38), vec2(0.8, -0.38), 0.0012);
  float dash = step(0.5, fract(gp.y*30.0));
  L += chalkLine(gp, vec2(-0.02, 0.4), vec2(-0.02, -0.45), 0.0012)*dash;
  float par = abs(gp.y - (0.42 - 1.6*(gp.x - 0.1)*(gp.x - 0.1)));
  L += stroke(par, 0.0016)*step(-0.4, gp.y)*(0.6 + 0.4*noise(gp*300.0));
  float circ = abs(length(gp - vec2(0.62, 0.05)) - 0.12);
  L += stroke(circ, 0.0014);
  col += vec3(0.85)*clamp(L, 0.0, 1.0)*0.55;
  // stray stars of chalk dust
  col += stars(p, 0.03, t)*0.5;

  float punch = 1.0 + 0.04*uKick*uReact;
  vec2 q = p/punch;
  if (uVar > 0.5) q.x = -q.x;
  vec3 m = mandala(q, t, uSeed, uVar, 1.0, true, 1.0);
  // keep chalk visible through the dark dial faces
  col = col*(1.0 - clamp(luma(m)*3.0, 0.0, 0.85)) + m;
  return col;
}
