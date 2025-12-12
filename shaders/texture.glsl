in vec2 v_uv;
out vec4 FragColor;

uniform float uTime;

// background effect
// https://www.shadertoy.com/view/4t3GWX

// uniform sampler2D uTexture;

float v(in vec2 uv, float d, float o) {
  return 1.0f -
         smoothstep(0.0, d, distance(uv.x, 0.5 + sin(o + uv.y * 3.0) * 0.3));
}

vec4 b(vec2 uv, float o) {
  float d = 0.05 + abs(sin(o * 0.2)) * 0.25 * distance(uv.y + 0.5, 0.0);
  return vec4(v(uv + vec2(d * 0.25, 0.0), d, o), 0.0, 0.0, 1.0) +
         vec4(0.0, v(uv - vec2(0.015, 0.005), d, o), 0.0, 1.0) +
         vec4(0.0, 0.0, v(uv - vec2(d * 0.5, 0.015), d, o), 1.0);
}

void main() {
  vec2 uv = v_uv.yx;
  uv.x *= 2.0;
  vec4 color = b(uv, uTime) * 0.5 + b(uv, uTime * 2.0) * 0.5 +
               b(uv + vec2(0.3, 0.0), uTime * 3.3) * 0.5;

  color *= 0.5f;
  FragColor = pow(color, vec4(1.0f / 2.2f));
}
