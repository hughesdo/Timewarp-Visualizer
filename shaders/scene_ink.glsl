// Scene: INK NEGATIVE — the mandala as black ink on white paper, mirrored, with slice glitch
vec3 render(vec2 p){
  float t = uTime;
  // slice glitch: horizontal bands jump sideways on hats
  float band = floor(p.y*24.0);
  float gk = floor(uFlow*4.0);
  float g = hash12(vec2(band, gk));
  float jump = (g > 0.86 ? (hash12(vec2(band, gk + 9.0)) - 0.5)*0.12 : 0.0)*(0.4 + uHat*uReact);
  vec2 q = p + vec2(jump, 0.0);
  // mirror edges (kaleido fold)
  float fold = 0.62 + 0.05*sin(uSceneT*0.4);
  if (abs(q.x) > fold) q.x = sign(q.x)*(2.0*fold - abs(q.x));
  if (uVar > 0.5) q = vec2(-q.x, q.y);
  float punch = 1.0 + 0.04*uKick*uReact;
  q /= punch;
  vec3 m = mandala(q, t, uSeed, uVar, 1.0, true, 1.0);
  float l = clamp(luma(m)*1.25, 0.0, 1.0);
  float sat = clamp(length(m - vec3(luma(m)))*1.5, 0.0, 1.0);
  vec3 paper = vec3(0.93, 0.97, 0.97) - 0.05*fbm3(p*3.0);
  vec3 ink = vec3(0.05, 0.06, 0.09);
  vec3 col = mix(paper, ink, clamp(pow(l, 0.7)*1.2, 0.0, 1.0));
  // the bright holographic bits become pale blue light
  col += vec3(-0.06, 0.0, 0.07)*sat*l;
  // one cold glare where the streak is hottest
  vec2 gq = rot(-0.65)*(q - vec2(0.3, 0.25));
  col = mix(col, vec3(0.75, 0.88, 1.0), exp(-length(gq*vec2(1.0, 6.0))*12.0)*(0.8 + 0.6*uTreble*uReact));
  // grey glitch blocks
  float blk = step(0.93, hash12(vec2(band, gk + 3.0)))*step(0.5, hash12(vec2(floor(p.x*8.0), band + gk)));
  col = mix(col, vec3(0.55, 0.57, 0.6), blk*0.6);
  return col;
}
