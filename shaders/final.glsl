#version 300 es
precision highp float;
uniform sampler2D uTex, uBloom1, uBloom2;
uniform vec2 uRes;
uniform float uTime, uBloomAmt, uGrain, uVignette, uFade;
in vec2 vUV;
out vec4 fragColor;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  vec3 b = texture(uBloom1, vUV).rgb*0.6 + texture(uBloom2, vUV).rgb*0.8;
  c += b*uBloomAmt;
  // gentle filmic shoulder, keeps neon saturated
  // linear below the knee (keeps the scene colours as authored), soft shoulder above
  vec3 k = 0.8 + 0.2*(1.0 - exp(-max(c - 0.8, 0.0)/0.2));
  c = mix(c, k, step(0.8, c));
  vec2 q = vUV - 0.5;
  c *= 1.0 - uVignette*dot(q, q)*1.6;
  c += (hash12(gl_FragCoord.xy + fract(uTime*7.13)*100.0) - 0.5)*uGrain;
  c *= uFade;
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
