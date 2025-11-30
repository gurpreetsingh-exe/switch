precision highp float;

in vec2 v_uv;
out vec4 color;

uniform int uCurrentFace;
uniform samplerCube uEnvironmentMap;
uniform float uResolution;
uniform float uRoughness;

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

// ==========================================
// GGX Distribution
// ==========================================
float DistributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;

  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = MATH_PI * denom * denom;

  return a2 / denom;
}

// ==========================================
// Radical inverse (Hammersley)
// ==========================================
float RadicalInverse_VdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);

  return float(bits) * 2.3283064365386963e-10;
}

vec2 Hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), RadicalInverse_VdC(i));
}

// ==========================================
// Importance sampling GGX
// (kept identical to original)
// ==========================================
vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;

  float phi = 2.0 * MATH_PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

  vec3 H;
  H.x = cos(phi) * sinTheta;
  H.y = sin(phi) * sinTheta;
  H.z = cosTheta;

  // tangent → world
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);

  vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
  return normalize(sampleVec);
}

// ==========================================
// MAIN
// ==========================================
void main() {
  // Convert UV to direction normal (your system)
  vec2 uv = v_uv * 2.0 - 1.0;
  vec3 N = normalize(uv_to_xyz(uCurrentFace, uv));

  // V = R = N (same simplification as original)
  vec3 V = N;
  vec3 R = N;

  const uint SAMPLE_COUNT = 1024u;
  float totalWeight = 0.0;
  vec3 prefilteredColor = vec3(0.0);

  // Loop samples
  for (uint i = 0u; i < SAMPLE_COUNT; i++) {
    vec2 Xi = Hammersley(i, SAMPLE_COUNT);
    vec3 H = ImportanceSampleGGX(Xi, N, uRoughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      float D = DistributionGGX(N, H, uRoughness);
      float NdotH = max(dot(N, H), 0.0);
      float HdotV = max(dot(H, V), 0.0);
      float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

      float saTexel = 4.0 * MATH_PI / (6.0 * uResolution * uResolution);
      float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

      float mipLevel = uRoughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);

      // Cubemap sampling
      prefilteredColor += textureLod(uEnvironmentMap, L, mipLevel).rgb * NdotL;
      totalWeight += NdotL;
    }
  }

  prefilteredColor /= totalWeight;

  color = vec4(prefilteredColor, 1.0);
}
