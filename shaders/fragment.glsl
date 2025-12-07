in vec3 v_position;
in vec3 v_normal;
out vec4 FragColor;

uniform samplerCube uIrradiance;
uniform samplerCube uPrefilter;
uniform sampler2D uBrdfLUT;
uniform vec3 uDiffuseColor;
uniform float uRoughness;
uniform float uMetallic;
uniform vec3 uLightDirection;

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0f) + 1.0f;
  d = MATH_PI * d * d;
  return a2 / max(d, 0.000001f);
}

float GeometrySchlickGGX(float NoV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;

  float nom = NoV;
  float denom = NoV * (1.0 - k) + k;

  return nom / denom;
}

float GeometrySmith(float NoV, float NoL, float roughness) {
  float ggx2 = GeometrySchlickGGX(NoV, roughness);
  float ggx1 = GeometrySchlickGGX(NoL, roughness);
  return ggx1 * ggx2;
}

vec3 F_Schlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 sunLight(vec3 lightDirection) { return normalize(-lightDirection); }

vec3 pointLight(vec3 lightPosition) {
  return normalize(lightPosition - v_position);
}

float getLight(float NoL, float lightIntensity) { return lightIntensity * NoL; }

const float GAMMA = 2.2;
const float INV_GAMMA = 1.0 / GAMMA;

const mat3 ACES_input_mat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834,
                                 0.13383, 0.04823, 0.01566, 0.83777);

const mat3 ACES_output_mat =
    mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367,
         -0.00605, 1.07602);

// linear to sRGB approximation
// see http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 linear_to_sRGB(vec3 color) { return pow(color, vec3(INV_GAMMA)); }

// ACES filmic tone map approximation
// see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
vec3 RRT_and_ODT_fit(vec3 color) {
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  return a / b;
}

vec3 tonemap_ACES_hill(vec3 color) {
  color = ACES_input_mat * color;
  color = RRT_and_ODT_fit(color);
  color = ACES_output_mat * color;
  color = clamp(color, 0.0, 1.0);
  return color;
}

vec3 tonemap(vec3 color) {
  color = tonemap_ACES_hill(color);
  return linear_to_sRGB(color);
}

void main() {
  vec3 P = v_position;
  vec3 N = v_normal;
  vec3 V = uViewVector;
  vec3 L = sunLight(uLightDirection);
  vec3 H = normalize(L + V);
  vec3 I = normalize(uCameraPosition - P);

  float NoV = abs(dot(N, V)) + 1e-5;
  float NoL = clamp(dot(N, L), 0.0f, 1.0f) + 1e-5;
  float NoH = clamp(dot(N, H), 0.0f, 1.0f) + 1e-5;
  float HoV = clamp(dot(H, V), 0.0f, 1.0f) + 1e-5;

  // float perceptualRoughness = uRoughness;
  // float roughness = perceptualRoughness * perceptualRoughness;
  float roughness = uRoughness;
  vec3 base_reflectivity = mix(vec3(0.04f), uDiffuseColor, uMetallic);

  vec3 Lo = vec3(0);
  {
    vec3 radiance = vec3(1) * getLight(NoL, 6.0f);

    float D = D_GGX(NoH, roughness);
    float G = GeometrySmith(NoV, NoL, roughness);
    vec3 F = F_Schlick(HoV, base_reflectivity);
    vec3 specular = D * G * F;
    specular /= 4.0f * NoV * NoL;

    vec3 kD = vec3(1.0f) - F;
    kD *= 1.0f - uMetallic;
    Lo += (kD * uDiffuseColor / MATH_PI + specular) * radiance * NoL;
  }

  vec3 F = F_Schlick(NoV, base_reflectivity);
  vec3 kD = 1.0f - F;
  kD *= 1.0f - uMetallic;

  vec3 irradiance = texture(uIrradiance, N).rgb;
  vec3 diffuse = irradiance * uDiffuseColor;

  vec3 prefilteredColor =
      textureLod(uPrefilter, reflect(I, N), roughness * MAX_MIP_LEVEL).rgb;
  vec2 brdf = texture(uBrdfLUT, vec2(NoV, roughness)).rg;
  vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

  const float ao = 1.0f;
  vec3 ambient = (kD * diffuse + specular) * ao;

  vec3 color = Lo + ambient;
  color = tonemap(color);
  FragColor = vec4(color, 1.0f);
}
