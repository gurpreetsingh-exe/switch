out vec2 v_uv;

void main() {
  float x = float((gl_VertexID & 1) << 2);
  float y = float((gl_VertexID & 2) << 1);
  v_uv = .5f * vec2(x, y);
  gl_Position = vec4(x - 1.f, y - 1.f, 0.f, 1.f);
}
