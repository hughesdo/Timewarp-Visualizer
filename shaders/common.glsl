#version 300 es
precision highp float;
precision highp int;

uniform vec2  uRes;
uniform float uTime;     // song time (s)
uniform float uFlow;     // energy-integrated time (moves faster when music is loud)
uniform float uSceneT;   // seconds since this scene started
uniform float uSeed;     // per-segment random seed (0..1)
uniform float uVar;      // per-segment variant (0..1)
uniform float uReact;    // reactivity gain

uniform float uBass, uLowMid, uMid, uHigh, uTreble, uLevel;
uniform float uKick, uSnare, uHat, uBeat, uBarPh;

uniform sampler2D uSpec;  // 64x1 log spectrum (R)
uniform sampler2D uMath;  // chalk formula atlas (R = ink)

out vec4 fragColor;

#define PI  3.14159265359
#define TAU 6.28318530718

float PX;   // one pixel in scene units

// ---------------------------------------------------------------- hashing / noise
float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ s += a*noise(p); p = m*p; a *= 0.5; }
  return s;
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++){ s += a*noise(p); p = m*p; a *= 0.5; }
  return s;
}

// ---------------------------------------------------------------- geometry
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); } // CCW
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0); return length(pa - ba*h); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdTri(vec2 p, vec2 q){ // isosceles, apex at origin, base at y=q.y
  p.x = abs(p.x);
  vec2 a = p - q*clamp(dot(p,q)/dot(q,q), 0.0, 1.0);
  vec2 b = p - q*vec2(clamp(p.x/q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a,a), s*(p.x*q.y-p.y*q.x)), vec2(dot(b,b), s*(p.y-q.y)));
  return -sqrt(d.x)*sign(d.y);
}
float sdHex(vec2 p, float r){
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p); p -= 2.0*min(dot(k.xy,p),0.0)*k.xy;
  p -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
  return length(p)*sign(p.y);
}
// antialiased stroke of half-width w around distance d
float stroke(float d, float w){ return clamp((w - d)/PX + 0.5, 0.0, 1.0); }
float fill(float d){ return clamp(0.5 - d/PX, 0.0, 1.0); }
float glow(float d, float s){ return exp(-max(d,0.0)/s); }

// ---------------------------------------------------------------- color
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0); return v*mix(vec3(1.0), k, s); }
// thin-film / holographic palette: pinks, cyans, golds, violets
vec3 irid(float x){
  x = fract(x)*5.0;
  int i = int(x);
  float f = fract(x); f = f*f*(3.0 - 2.0*f);
  const vec3 c0 = vec3(1.0, 0.32, 0.62), c1 = vec3(1.0, 0.70, 0.40), c2 = vec3(0.40, 0.95, 0.95),
             c3 = vec3(0.42, 0.52, 1.0),  c4 = vec3(0.86, 0.42, 1.0);
  vec3 a = i == 0 ? c0 : i == 1 ? c1 : i == 2 ? c2 : i == 3 ? c3 : c4;
  vec3 b = i == 0 ? c1 : i == 1 ? c2 : i == 2 ? c3 : i == 3 ? c4 : c0;
  return mix(a, b, f);
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

// audio helpers
float spec(float x){ return texture(uSpec, vec2(clamp(x,0.0,1.0), 0.5)).r; }
float R_(float v){ return v*uReact; }

// ---------------------------------------------------------------- roman numerals
// glyph space: height 1 centered at 0. Serif strokes, thick/thin like an antique dial.
float gI(vec2 q){
  float d = sdBox(q, vec2(0.075, 0.5));
  d = min(d, sdBox(q - vec2(0.0, 0.465), vec2(0.17, 0.035)));
  d = min(d, sdBox(q + vec2(0.0, 0.465), vec2(0.17, 0.035)));
  return d;
}
float gV(vec2 q){
  float d = sdSeg(q, vec2(-0.25, 0.47), vec2(0.0, -0.5)) - 0.07;
  d = min(d, sdSeg(q, vec2(0.25, 0.47), vec2(0.0, -0.5)) - 0.028);
  d = min(d, sdBox(q - vec2(-0.25, 0.465), vec2(0.14, 0.035)));
  d = min(d, sdBox(q - vec2( 0.25, 0.465), vec2(0.11, 0.035)));
  return d;
}
float gX(vec2 q){
  float d = sdSeg(q, vec2(-0.23, 0.47), vec2(0.23, -0.47)) - 0.07;
  d = min(d, sdSeg(q, vec2(0.23, 0.47), vec2(-0.23, -0.47)) - 0.028);
  d = min(d, sdBox(q - vec2(-0.23, 0.465), vec2(0.13, 0.035)));
  d = min(d, sdBox(q - vec2( 0.23, 0.465), vec2(0.13, 0.035)));
  d = min(d, sdBox(q - vec2(-0.23,-0.465), vec2(0.13, 0.035)));
  d = min(d, sdBox(q - vec2( 0.23,-0.465), vec2(0.13, 0.035)));
  return d;
}
// chars: 1=I 2=V 3=X ; packed base-4, first char in low bits
const int ROM[13] = int[13](0, 1, 5, 21, 9, 2, 6, 22, 86, 13, 3, 7, 23);
const int RLEN[13] = int[13](0, 1, 2, 3, 2, 1, 2, 3, 4, 2, 1, 2, 3);
float adv(int c){ return c == 1 ? 0.38 : 0.66; }
float roman(vec2 q, int n){
  int code = ROM[n], len = RLEN[n];
  float w = 0.0;
  for (int i = 0; i < 4; i++){ if (i >= len) break; w += adv((code >> (2*i)) & 3); }
  float x = -0.5*w, d = 1e5;
  for (int i = 0; i < 4; i++){
    if (i >= len) break;
    int c = (code >> (2*i)) & 3;
    float a = adv(c);
    vec2 cq = q - vec2(x + 0.5*a, 0.0);
    d = min(d, c == 1 ? gI(cq) : (c == 2 ? gV(cq) : gX(cq)));
    x += a;
  }
  return d;
}

// ---------------------------------------------------------------- clock
// hand: clockwise angle ang from 12 o'clock, returns sdf
float handSDF(vec2 q, float ang, float len, float w, float tipW, float tipL){
  vec2 h = rot(ang)*q;
  float d = sdSeg(h, vec2(0.0, -len*0.18), vec2(0.0, len - tipL*0.9)) - w;
  d = min(d, sdTri(vec2(h.x, len - h.y), vec2(tipW, tipL)));
  // little counterweight ring
  d = min(d, abs(length(h - vec2(0.0, -len*0.18)) - w*2.2) - w*0.6);
  return d;
}

// Draws a neon antique clock into col.
//  c: center, R: face radius, spin: dial rotation, hA/mA: hand angles,
//  rimC/numC/handC: colors, detail 0..2 (0 tiny, 1 normal, 2 hero with ornament + fringe), bright
void drawClock(inout vec3 col, vec2 p, vec2 c, float R, float spin, float hA, float mA,
               vec3 rimC, vec3 numC, vec3 handC, float detail, float bright)
{
  vec2 q = p - c;
  float r = length(q);
  float outerR = (detail > 1.5 ? 1.42 : 1.12)*R;
  if (r > outerR + 0.06) return;
  q = rot(spin)*q;
  float a = atan(q.x, q.y);                     // 0 at 12 o'clock, clockwise
  float px = PX;

  // soft halo behind (rim colour + the blue-violet bloom the source dials have)
  col += rimC*0.18*bright*glow(r - R, 0.10*R + 0.004)*smoothstep(0.7*R, R, r);
  col += vec3(0.22, 0.25, 1.0)*0.16*bright*glow(r - R, 0.06*R + 0.006)*smoothstep(0.9*R, R, r);

  // ornamental outer band (hero dial)
  if (detail > 1.5){
    float band = smoothstep(R, R+px, r)*smoothstep(1.36*R+px, 1.36*R, r);
    col = mix(col, vec3(0.012,0.01,0.03), band*0.85);
    col += vec3(1.0,0.25,0.4)*stroke(abs(r - 1.10*R), 0.006*R)*0.9*bright;
    col += vec3(0.25,0.55,1.0)*stroke(abs(r - 1.22*R), 0.005*R)*0.9*bright;
    col += vec3(1.0,0.35,0.55)*stroke(abs(r - 1.36*R), 0.009*R)*bright;
    col += vec3(0.4,0.3,1.0)*0.5*glow(abs(r - 1.36*R), 0.03*R)*bright;
    // fine radial lattice between rings
    float a72 = a/(TAU/72.0);
    float fd = abs(fract(a72 + 0.5) - 0.5)*(TAU/72.0)*r;
    col += vec3(0.85,0.75,0.95)*0.55*stroke(fd, 0.0025*R)*smoothstep(1.11*R,1.12*R,r)*smoothstep(1.22*R,1.21*R,r)*bright;
    float a24 = a/(TAU/24.0);
    float fd2 = abs(fract(a24 + 0.5) - 0.5)*(TAU/24.0)*r;
    col += vec3(1.0,0.6,0.8)*0.8*stroke(fd2, 0.004*R)*smoothstep(1.22*R,1.23*R,r)*smoothstep(1.36*R,1.35*R,r)*bright;
    // chevrons on outer band
    vec2 cq = rot(floor(a/(TAU/12.0) + 0.5)*(TAU/12.0))*q;
    float chev = abs(sdTri(vec2(cq.x, 1.33*R - cq.y), vec2(0.035*R, 0.07*R)));
    col += vec3(1.0,0.85,0.7)*0.7*stroke(chev, 0.003*R)*bright;
  }

  // dial face
  float face = fill(r - R);
  vec3 faceC = vec3(0.006, 0.006, 0.016) + rimC*0.02*smoothstep(0.3*R, R, r);
  col = mix(col, faceC, face*0.94);

  // rims
  col += rimC*stroke(abs(r - R), (detail > 1.5 ? 0.011 : 0.016)*R + 0.35*px)*(detail > 1.5 ? 0.9 : 1.25)*bright;
  col += rimC*0.45*glow(abs(r - R), 0.035*R)*bright;
  if (detail > 0.5) col += mix(rimC, vec3(1.0), 0.5)*stroke(abs(r - 0.94*R), 0.004*R + 0.2*px)*0.7*bright;

  // minute ticks
  float a60 = a/(TAU/60.0);
  float ti = floor(a60 + 0.5);
  float td = abs(a60 - ti)*(TAU/60.0)*r;
  bool major = mod(ti, 5.0) < 0.5;
  float tin = major ? 0.86*R : 0.895*R;
  float tickM = stroke(td, (major ? 0.011 : 0.0045)*R + 0.25*px)*smoothstep(tin, tin + px, r)*smoothstep(0.935*R, 0.935*R - px, r);
  col += mix(numC, vec3(1.0), 0.3)*tickM*0.9*bright;

  // numerals
  if (detail > 0.5 && r > 0.55*R && r < 0.88*R){
    float seg = TAU/12.0;
    float idx = floor(a/seg + 0.5);
    vec2 qq = rot(idx*seg)*q - vec2(0.0, 0.715*R);
    float gh = 0.165*R;
    int n = int(mod(idx + 12.0, 12.0)); if (n == 0) n = 12;
    float d = roman(qq/gh, n)*gh;
    if (detail > 1.5){
      float off = 0.012*R;
      float dr = roman((qq + vec2(off, 0.0))/gh, n)*gh;
      float db = roman((qq - vec2(off, 0.0))/gh, n)*gh;
      vec3 m = vec3(fill(dr), fill(d), fill(db));
      col = col*(1.0 - m*0.9) + numC*m*1.15*bright;
      col += numC*0.35*glow(d, 0.02*R)*bright;
    } else {
      float m = fill(d);
      col = mix(col, numC*bright*1.1, m);
      col += numC*0.25*glow(d, 0.02*R)*bright;
    }
  }

  // inner rings
  if (detail > 0.5){
    col += vec3(0.2,0.85,1.0)*stroke(abs(r - 0.53*R), 0.006*R + 0.2*px)*bright;
    col += vec3(0.2,0.85,1.0)*0.3*glow(abs(r - 0.53*R), 0.02*R)*bright;
    col += vec3(1.0,0.25,0.25)*stroke(abs(r - 0.30*R), 0.004*R + 0.2*px)*0.9*bright;
  }

  // hands
  float hd = handSDF(q, hA, 0.50*R, 0.018*R, 0.055*R, 0.13*R);
  float md = handSDF(q, mA, 0.80*R, 0.014*R, 0.045*R, 0.12*R);
  float sd = sdSeg(rot(mA*12.0 + 1.7)*q, vec2(0.0, -0.2*R), vec2(0.0, 0.85*R)) - 0.004*R;
  col = mix(col, handC*0.25, fill(min(hd, md)));
  col += handC*stroke(abs(min(hd, md)), 0.006*R + 0.3*px)*1.4*bright;
  col += handC*0.35*glow(min(hd, md), 0.03*R)*bright;
  if (detail > 0.5) col += vec3(1.0,0.2,0.25)*stroke(sd, 0.0)*0.9*bright + vec3(1.0,0.2,0.25)*0.2*glow(sd, 0.01*R);
  // hub
  float hub = abs(r - 0.045*R) - 0.012*R;
  col = mix(col, vec3(1.0,0.55,0.3)*bright, fill(hub));
  col += vec3(1.0,0.4,0.2)*0.4*glow(hub, 0.03*R);
}

// ---------------------------------------------------------------- iridescent filaments
// a bundle of thin holographic strands from A to B bulging to half-width W
vec3 filaments(vec2 p, vec2 A, vec2 B, float W, float seed, float t, float energy, int N){
  vec2 ab = B - A; float L = length(ab); vec2 dir = ab/L; vec2 nrm = vec2(-dir.y, dir.x);
  float u = dot(p - A, dir)/L;
  float v = dot(p - A, nrm);
  if (u < -0.02 || u > 1.02 || abs(v) > W*1.6) return vec3(0.0);
  float uc = clamp(u, 0.0, 1.0);
  vec3 acc = vec3(0.0);
  float shimmer = 0.6 + 0.8*energy;
  for (int i = 0; i < 40; i++){
    if (i >= N) break;
    float fi = float(i) + seed*17.0;
    float h1 = hash11(fi*1.37), h2 = hash11(fi*2.11 + 3.0), h3 = hash11(fi*0.73 + 7.0);
    float e = mix(0.55, 1.6, h2);
    float env = pow(sin(uc*PI), e)*(0.72 - 0.28*cos(uc*TAU*2.0));
    float side = (h1*2.0 - 1.0);
    float off = side*W*env*(h3 > 0.8 ? 1.7 : 1.0);
    float wob = (noise(vec2(uc*(2.5 + 3.0*h3) + fi*3.1, t*0.35 + fi)) - 0.5)*W*0.9*env;
    // jagged kinks
    wob += (abs(noise(vec2(uc*22.0 + fi, t*0.8)) - 0.5) - 0.25)*W*0.12*env;
    float d = abs(v - off - wob);
    float w = 0.0009 + 0.0022*env*(0.5 + h3);
    float I = exp(-d/w)*0.9 + exp(-d/(w*6.0))*0.18;
    vec3 c = irid(h1*0.8 + uc*0.55 + t*0.04 + seed);
    float tw = 0.65 + 0.35*sin(fi*7.0 + t*(3.0 + 4.0*h2)*shimmer);
    acc += c*I*tw*(0.55 + 0.6*pow(1.0 - env, 2.0));
  }
  // translucent membrane between strands
  float envM = pow(sin(uc*PI), 0.9);
  float mem = smoothstep(W*envM, W*envM*0.2, abs(v))*envM;
  acc += irid(uc*0.9 + v*4.0 + t*0.05 + seed)*mem*0.07*(0.7 + energy);
  // hot tips
  float tip = exp(-abs(v)/0.004)*(smoothstep(0.75, 1.0, u)*smoothstep(1.02, 0.97, u) + smoothstep(0.25, 0.0, u)*smoothstep(-0.02, 0.03, u));
  acc += vec3(1.0, 0.85, 0.95)*tip*0.6;
  return acc;
}

// fan of crystal shards from origin o, centered on angle ang (radians, math convention)
vec3 shards(vec2 p, vec2 o, float ang, float spread, float len, float seed, float t, float energy){
  vec2 q = p - o;
  float r = length(q);
  if (r > len*1.15) return vec3(0.0);
  float a = atan(q.y, q.x);
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 9; k++){
    float fk = float(k) + seed*13.0;
    float hk = hash11(fk*1.91), hl = hash11(fk*3.17 + 1.0);
    float ak = ang + (hk - 0.5)*spread + 0.08*sin(t*0.7 + fk);
    float Lk = len*mix(0.45, 1.0, hl)*(0.85 + 0.3*energy);
    float da = a - ak; da = mod(da + PI, TAU) - PI;
    float d = abs(da)*r;
    float hw = 0.05*len*mix(0.4, 1.3, hk)*(1.0 - r/Lk)*smoothstep(0.0, 0.25*Lk, r);
    if (r > Lk || hw <= 0.0) continue;
    float inside = smoothstep(hw, hw*0.4, d);
    float edge = exp(-abs(d - hw)/0.0018);
    vec3 c = irid(hk + r/len*0.7 + t*0.03);
    acc += c*(inside*0.22 + edge*0.9)*smoothstep(0.0, 0.08*len, r);
  }
  return acc;
}

// angle-periodic noise (blends across the atan seam)
float noiseA(float a, float k, float y){ float w = (a + PI)/TAU; return mix(noise(vec2((a + TAU)*k, y)), noise(vec2(a*k, y)), w); }
float fbmA(float a, float k, float y){ float w = (a + PI)/TAU; return mix(fbm(vec2((a + TAU)*k, y)), fbm(vec2(a*k, y)), w); }

// chalk formula atlas lookup (tiled), lod for blur
float chalk(vec2 uv, float lod){ return textureLod(uMath, uv, lod).r; }

vec3 stars(vec2 p, float dens, float t){
  vec3 c = vec3(0.0);
  for (int l = 0; l < 2; l++){
    float sc = 60.0 + float(l)*70.0;
    vec2 g = p*sc + float(l)*13.0;
    vec2 id = floor(g), f = fract(g) - 0.5;
    float h = hash12(id + float(l)*7.0);
    if (h > 1.0 - dens){
      vec2 o = hash22(id) - 0.5;
      float d = length(f - o*0.7);
      float tw = 0.6 + 0.4*sin(t*(2.0 + 5.0*h) + h*40.0);
      c += vec3(0.8,0.85,1.0)*exp(-d*d*900.0/(1.0+float(l)))*tw*(0.4 + 0.6*h);
    }
  }
  return c;
}

vec3 render(vec2 p);

void main(){
  float sc = min(uRes.y, uRes.x*9.0/16.0);
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/sc;
  PX = 1.0/sc;
  vec3 c = render(p);
  fragColor = vec4(max(c, 0.0), 1.0);
}
