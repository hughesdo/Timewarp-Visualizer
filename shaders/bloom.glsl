#version 300 es
precision highp float;
// mode 0: bright-pass downsample, mode 1: separable gaussian blur
uniform sampler2D uTex;
uniform vec2 uTexel;     // texel size of source
uniform vec2 uDir;       // blur direction (mode 1)
uniform int  uMode;
uniform float uThresh;
out vec4 fragColor;
in vec2 vUV;
void main(){
  if (uMode == 0){
    vec3 c = vec3(0.0);
    c += texture(uTex, vUV + uTexel*vec2(-1.0, -1.0)).rgb;
    c += texture(uTex, vUV + uTexel*vec2( 1.0, -1.0)).rgb;
    c += texture(uTex, vUV + uTexel*vec2(-1.0,  1.0)).rgb;
    c += texture(uTex, vUV + uTexel*vec2( 1.0,  1.0)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThresh, uThresh + 0.35, l);
    fragColor = vec4(c, 1.0);
  } else {
    // 9-tap gaussian using linear sampling offsets
    vec3 c = texture(uTex, vUV).rgb*0.2270270270;
    c += texture(uTex, vUV + uDir*uTexel*1.3846153846).rgb*0.3162162162;
    c += texture(uTex, vUV - uDir*uTexel*1.3846153846).rgb*0.3162162162;
    c += texture(uTex, vUV + uDir*uTexel*3.2307692308).rgb*0.0702702703;
    c += texture(uTex, vUV - uDir*uTexel*3.2307692308).rgb*0.0702702703;
    fragColor = vec4(c, 1.0);
  }
}
