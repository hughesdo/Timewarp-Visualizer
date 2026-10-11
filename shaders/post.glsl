#version 300 es
precision highp float;
// Composite: transition between scene A and B, plus event FX lifted from the reference edit
uniform sampler2D uA, uB;
uniform vec2  uRes;
uniform float uTime, uMix, uSeed;
uniform int   uTrans;          // 0 cut 1 flash 2 flare 3 zoom 4 barwipe 5 pixel 6 glitch 7 curve 8 smear
uniform float uWipeAng;
uniform float uZoom, uRGB, uFlash, uWash, uInvert, uLED, uEdge, uSlice, uCurve, uSmear, uBolt, uEcho;
uniform vec4  uBar;            // amount, angle, position(-1..1), width
uniform vec4  uBar2;
uniform vec4  uFlare;          // amount, x, y, hue shift
out vec4 fragColor;

#define PI 3.14159265359
float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }

float aspect;

float transW(vec2 uv){
  float m = uMix;
  if (uTrans == 0 || uTrans == 7) return step(0.5, m);
  if (uTrans == 4){
    vec2 d = vec2(cos(uWipeAng), sin(uWipeAng));
    float s = dot((uv - 0.5)*vec2(aspect, 1.0), d);
    float reach = 0.5*(abs(d.x)*aspect + abs(d.y)) + 0.1;
    return step(s, mix(-reach, reach, m));
  }
  if (uTrans == 5){
    vec2 cell = floor(uv*uRes/vec2(10.0, 14.0)*(1080.0/uRes.y));
    return step(hash12(cell), m);
  }
  if (uTrans == 6){
    float band = floor(uv.y*28.0) + floor(m*10.0)*13.0;
    return step(hash11(band), m*1.15 - 0.075);
  }
  return smoothstep(0.3, 0.7, m);
}

vec3 src(vec2 uv){
  uv = clamp(uv, vec2(0.0005), vec2(0.9995));
  float w = transW(uv);
  vec3 c = vec3(0.0);
  if (w < 1.0) c += textureLod(uA, uv, 0.0).rgb*(1.0 - w);
  if (w > 0.0) c += textureLod(uB, uv, 0.0).rgb*w;
  return c;
}
// rgb-split sample
vec3 srcRGB(vec2 uv, float k){
  if (k <= 0.0) return src(uv);
  vec2 dir = (uv - 0.5)*vec2(aspect, 1.0);
  vec2 off = normalize(dir + 1e-5)*k*(0.4 + length(dir));
  off.x /= aspect;
  return vec3(src(uv + off).r, src(uv).g, src(uv - off).b);
}

void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  aspect = uRes.x/uRes.y;
  vec2 p = (uv - 0.5)*vec2(aspect, 1.0);

  // --- curved screen squeeze (reference 11.2s)
  float outside = 0.0;
  if (uCurve > 0.0){
    float X = (uv.x - 0.5)*2.0;
    float halfH = 0.5*(1.0 - uCurve*(0.18 + 0.22*(1.0 - X*X)));
    float y = (uv.y - 0.5)/(2.0*halfH) + 0.5;
    float x = 0.5 + (uv.x - 0.5)*(1.0 + uCurve*0.25*abs(X));
    outside = step(0.5, abs(y - 0.5)) ;
    uv = vec2(x, y);
  }
  // --- slice glitch
  if (uSlice > 0.0){
    float band = floor(uv.y*36.0);
    float k = floor(uTime*14.0);
    float h = hash12(vec2(band, k));
    if (h > 1.0 - uSlice*0.6) uv.x += (hash12(vec2(band, k + 5.0)) - 0.5)*0.15*uSlice;
  }
  // --- LED dot matrix
  vec2 ledF = vec2(0.0);
  float ledScale = 1080.0/uRes.y;
  vec2 cellPx = vec2(7.0, 10.0)/ledScale;
  vec2 uvLED = uv;
  if (uLED > 0.0){
    vec2 g = gl_FragCoord.xy/cellPx;
    ledF = fract(g) - 0.5;
    uvLED = (floor(g) + 0.5)*cellPx/uRes;
  }
  vec2 suv = mix(uv, uvLED, step(0.001, uLED));

  // --- sampling with zoom / smear blur and rgb split
  vec3 col;
  float rgb = uRGB;
  if (uZoom > 0.001 || uSmear > 0.001 || uEcho > 0.001){
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 10; i++){
      float fi = float(i)/9.0;
      vec2 u2 = suv;
      u2 = 0.5 + (u2 - 0.5)*(1.0 - uZoom*fi*0.35);
      u2.y += uSmear*fi*0.08;
      float wt = 1.0 - fi*0.6;
      acc += srcRGB(u2, rgb)*wt; wsum += wt;
    }
    col = acc/wsum;
    if (uEcho > 0.001){
      // horizontal mirror echoes
      vec3 e = src(vec2(0.5 + (suv.x - 0.5)*0.6, suv.y))*0.5 + src(vec2(0.5 + (suv.x - 0.5)*0.35, suv.y))*0.3;
      col = mix(col, max(col, e*vec3(0.7, 0.8, 1.0)), uEcho);
    }
  } else {
    col = srcRGB(suv, rgb);
  }

  // --- edge neon (reference 20.0s)
  if (uEdge > 0.001){
    vec2 px = 1.5/uRes;
    float l  = dot(src(suv), vec3(0.33));
    float lx = dot(src(suv + vec2(px.x, 0.0)), vec3(0.33)) - dot(src(suv - vec2(px.x, 0.0)), vec3(0.33));
    float ly = dot(src(suv + vec2(0.0, px.y)), vec3(0.33)) - dot(src(suv - vec2(0.0, px.y)), vec3(0.33));
    float e = clamp(length(vec2(lx, ly))*3.0, 0.0, 1.0);
    vec3 hue = normalize(col + 0.05)*1.4;
    col = mix(col, hue*e*1.6 + col*0.08, uEdge);
  }

  // --- LED shaping
  if (uLED > 0.001){
    float l = dot(col, vec3(0.3, 0.55, 0.15));
    float on = smoothstep(0.1, 0.25, l);
    float shape = smoothstep(0.3, 0.2, abs(ledF.x))*smoothstep(0.48, 0.36, abs(ledF.y));
    vec3 lit = normalize(col + 1e-4)*1.3*min(l*2.2, 1.5) + 0.12;
    vec3 led = lit*on*shape + vec3(0.02)*shape*(1.0 - on);
    col = mix(col, led, uLED);
  }

  if (outside > 0.5) col = vec3(0.0);

  // --- invert / wash / flash
  col = mix(col, vec3(1.0) - clamp(col, 0.0, 1.0)*vec3(0.95, 0.93, 0.9), uInvert);
  col = mix(col, vec3(0.86, 0.86, 0.88) + col*0.25, uWash);

  // --- light bars (cream white with chromatic edges)
  for (int b = 0; b < 2; b++){
    vec4 B = b == 0 ? uBar : uBar2;
    if (B.x > 0.001){
      vec2 d = vec2(cos(B.y), sin(B.y));
      float s = dot(p, d) - B.z*0.5*(abs(d.x)*aspect + abs(d.y));
      float w = B.w;
      float m = smoothstep(w, w*0.75, abs(s));
      vec3 barC = vec3(1.0, 0.97, 0.9) - col*0.12;
      col = mix(col, barC, m*B.x);
      col += vec3(0.2, 1.0, 0.9)*exp(-abs(s - w)/0.004)*0.6*B.x;
      col += vec3(1.0, 0.3, 0.6)*exp(-abs(s + w)/0.004)*0.6*B.x;
      col += vec3(1.0, 0.95, 0.9)*exp(-abs(s)/(w*3.0))*0.25*B.x;
    }
  }

  // --- lens flare burst (reference 0.4s / 5.0s)
  if (uFlare.x > 0.001){
    vec2 fc = vec2(uFlare.y, uFlare.z);
    vec2 q = p - fc;
    float a = uFlare.x;
    vec3 wash = mix(vec3(0.85, 0.04, 0.2), vec3(0.9, 0.1, 0.5), uFlare.w);
    col = mix(col, wash + col*0.3, a*0.65*smoothstep(1.4, 0.1, length(q)));
    col += vec3(0.5, 1.0, 0.5)*exp(-abs(q.y)*240.0)*exp(-abs(q.x)*1.2)*a*1.4;
    col += vec3(0.8, 1.0, 0.7)*exp(-abs(q.x)*300.0)*exp(-abs(q.y)*2.0)*a*0.9;
    col += vec3(1.0, 0.9, 1.0)*exp(-length(q)*18.0)*a*2.0;
    col += vec3(0.9, 0.3, 1.0)*exp(-length((q - vec2(0.25, 0.08))*vec2(1.0, 3.0))*6.0)*a*0.8;
  }

  // --- lightning bolt (reference 16.4s)
  if (uBolt > 0.001){
    float k = floor(uTime*20.0);
    vec2 q = p;
    float ang = -0.7 + (hash11(k*0.37 + uSeed) - 0.5)*0.6;
    q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang))*q;
    float y = 0.0, amp = 0.12, fr = 4.0;
    for (int i = 0; i < 5; i++){ y += (noise(vec2(q.x*fr, k + float(i)*7.0)) - 0.5)*amp; amp *= 0.55; fr *= 2.1; }
    float d = abs(q.y - y);
    float bolt = exp(-d/0.003) + exp(-d/0.04)*0.4;
    float yb = y + (noise(vec2(q.x*9.0, k + 40.0)) - 0.5)*0.15*smoothstep(-0.1, 0.4, q.x);
    bolt += (exp(-abs(q.y - yb)/0.002) + exp(-abs(q.y - yb)/0.02)*0.3)*smoothstep(-0.1, 0.3, q.x)*0.7;
    col += vec3(0.85, 0.92, 1.0)*bolt*uBolt*smoothstep(0.9, 0.3, abs(q.x));
  }

  col += vec3(uFlash);
  fragColor = vec4(max(col, 0.0), 1.0);
}
