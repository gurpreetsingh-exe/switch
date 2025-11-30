in vec2 v_uv;
out vec4 color;

uniform int uCurrentFace;
uniform samplerCube uHdri;

vec3 uv_to_xyz(int face, vec2 uv) {
  if (face == 0) {
    return vec3(1.f, uv.y, -uv.x);
  } else if (face == 1) {
    return vec3(-1.f, uv.y, uv.x);
  } else if (face == 2) {
    return vec3(uv.x, -1.f, uv.y);
  } else if (face == 3) {
    return vec3(uv.x, 1.f, -uv.y);
  } else if (face == 4) {
    return vec3(uv.x, uv.y, 1.f);
  } else {
    return vec3(-uv.x, uv.y, -1.f);
  }
}

void main(void) {
  vec2 coords = v_uv * 2.0 - 1.0;
  vec3 N = normalize(uv_to_xyz(uCurrentFace, coords));

  vec3 irradiance = vec3(0.0);

  vec3 up = vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(up, N));
  if (length(right) < 1e-5) {
    right = vec3(1.0, 0.0, 0.0);
  }

  up = normalize(cross(N, right));

  float sampleDelta = 0.025;
  float nrSamples = 0.0;
  for (float phi = 0.0; phi < 2.0 * MATH_PI; phi += sampleDelta) {
    for (float theta = 0.0; theta < 0.5 * MATH_PI; theta += sampleDelta) {
      vec3 tangentSample =
          vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));

      vec3 sampleVec =
          tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;

      irradiance += texture(uHdri, sampleVec).rgb * cos(theta) * sin(theta);

      nrSamples += 1.0;
    }
  }

  irradiance = MATH_PI * irradiance / nrSamples;
  color = vec4(irradiance, 1.0);
}
