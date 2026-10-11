// Scene: ECLIPSE RING — peach corona ring framing the dial, faint chalk behind
vec3 render(vec2 p){
  float t = uTime;
  vec3 col = vec3(0.004, 0.003, 0.006);
  // faint drifting chalk in the dark
  float m = chalk(p*0.35 + vec2(t*0.004 + uSeed, 0.3), 1.6);
  col += vec3(0.6, 0.6, 0.65)*m*0.07*(0.5 + uSnare*uReact);
  vec2 q = p - vec2(0.0, -0.01);
  q *= 1.0 + 0.06*sin(uSceneT*0.2);
  col += eclipse(q, 0.36, t, 0.0, uSeed, 2.0);
  return col;
}
