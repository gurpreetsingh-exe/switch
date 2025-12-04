in vec3 aVertexPosition;
in vec3 aNormal;
out vec3 v_position;
out vec3 v_normal;

uniform mat4 uModelMatrix;

void main() {
  vec4 position = uModelMatrix * vec4(aVertexPosition, 1.0f);
  v_position = position.xyz;
  v_normal = normalize(mat3(uModelMatrix) * aNormal);
  gl_Position = uProjectionMatrix * uViewMatrix * position;
}
