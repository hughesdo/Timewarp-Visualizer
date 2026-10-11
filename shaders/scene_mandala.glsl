// Scene: CHRONO MANDALA — ornate dial, satellite clocks, holographic filament streak
vec3 render(vec2 p){
  float t = uTime;
  float punch = 1.0 + 0.045*uKick*uReact + 0.015*uBass*uReact;
  float tilt = 0.05*sin(t*0.11 + uSeed*9.0);
  vec2 q = rot(tilt)*p/punch;
  if (uVar > 0.66) q.x = -q.x;                 // mirrored variant
  q *= 1.0 + 0.04*sin(uSceneT*0.25);          // slow push in/out
  vec3 col = vec3(0.004, 0.004, 0.012);
  // faint deep haze behind the dial
  col += vec3(0.08, 0.05, 0.25)*0.25*exp(-length(q)*2.5)*(0.6 + uBass*uReact);
  col += mandala(q, t, uSeed, uVar, 1.0, true, 1.0);
  return col;
}
