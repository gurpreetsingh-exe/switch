import { initShaderProgram } from './shader.js'
import Material from './material.js'
import { loadModel } from './loaders.js'
import { loadEnvTexture } from './texture.js'
import { gl, initContext } from './context.js'
import State from './state.js'
import { IntroScene, OrbitScene } from './scene.js'
import Mesh from './mesh.js'
import Renderer from './renderer.js'

const vsSource = `#version 300 es
    precision highp float;

    in vec3 aVertexPosition;
    in vec3 aNormal;
    out vec3 v_position;
    out vec3 v_normal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main() {
        vec4 position = uModelMatrix * vec4(aVertexPosition, 1.0f);
        v_position = position.xyz;
        v_normal = normalize(mat3(uModelMatrix) * aNormal);
        gl_Position = uProjectionMatrix * uViewMatrix * position;
    }
  `

const fsSource = `#version 300 es
    precision highp float;

    in vec3 v_position;
    in vec3 v_normal;
    out vec4 FragColor;

    uniform sampler2D uTexture;
    uniform samplerCube uHdri;
    uniform vec3 uDiffuseColor;
    uniform vec3 uViewVector;
    uniform vec3 uLightDirection;
    uniform vec3 uCameraPosition;

    #define PI 3.14159f

    float D_GGX(float NoH, float a) {
      float a2 = a * a;
      float d = NoH * NoH * (a2 - 1.0f) + 1.0f;
      d = PI * d * d;
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

    vec3 sunLight(vec3 lightDirection) {
        return normalize(-lightDirection);
    }

    vec3 pointLight(vec3 lightPosition) {
        return normalize(lightPosition - v_position);
    }

    float getLight(float NoL, float lightIntensity) {
        return lightIntensity * NoL;
    }

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

        float NoV = abs(dot(N, V)) + 1e-5;
        float NoL = clamp(dot(N, L), 0.0f, 1.0f);
        float NoH = clamp(dot(N, H), 0.0f, 1.0f);
        float HoV = clamp(dot(H, V), 0.0f, 1.0f);

        vec3 radiance = vec3(1) * getLight(NoL, 6.0f);

        float perceptualRoughness = 1.0f;
        float roughness = perceptualRoughness * perceptualRoughness;
        vec3 base_reflectivity = vec3(0.04f);

        float D = D_GGX(NoH, roughness);
        float G = GeometrySmith(NoV, NoL, roughness);
        vec3 F = F_Schlick(HoV, base_reflectivity);
        vec3 specular = D * G * F;
        specular /= 4.0f * NoV * NoL;

        vec3 Lo = vec3(0);
        vec3 kD = vec3(1.0f) - F;
        Lo += (kD * uDiffuseColor / PI + specular) * radiance * NoL;
        vec3 color = Lo;
        vec3 I = normalize(uCameraPosition - P);
        vec3 R = normalize(reflect(I, N));
        vec3 sp = textureLod(uHdri, R, 6.0).rgb;

        vec3 irradiance = textureLod(uHdri, N, 8.0).rgb;
        vec3 diffuse = uDiffuseColor / PI * irradiance;

        float lod = roughness * 8.0;
        vec3 prefilteredColor = textureLod(uHdri, R, lod).rgb;
        specular = prefilteredColor * F_Schlick(max(dot(R, V), 0.0), base_reflectivity) * 0.2f;

        color = diffuse + specular;
        color = tonemap(color);
        FragColor = vec4(color, 1.0f);
    }
  `

let programInfo = null
const state = new State()
let renderer = null

const rot = { x: 0, y: 0 }

const easeInOutElastic = (x) => {
    const c5 = (2 * Math.PI) / 4.5;

    return x === 0
        ? 0
        : x === 1
            ? 1
            : x < 0.5
                ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
                : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}

const random_rotation = [-1, 0.5, 0]
// const random_rotation = [0, 0, 0];
let progress = 0

window.addEventListener('mousemove', e => {
    const halfWidth = (gl.canvas.width / 2)
    const halfHeight = (gl.canvas.height / 2)
    const x = e.clientX - halfWidth
    const y = e.clientY - halfHeight
    const unit = 1
    rot.x = (x / halfWidth) * unit
    rot.y = (y / halfHeight) * unit
})

document.addEventListener('wheel', e => {
    progress -= e.wheelDelta / 100
    progress = Math.max(Math.min(progress, 100), 0)
})

const draw = (_deltaTime) => {
    // gl.clearColor(0.1, 0.1, 0.1, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const modelMatrix = mat4.create()

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    gl.useProgram(programInfo.program)

    const camera = renderer.camera;
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false, camera.projectionMatrix,
    )
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.viewMatrix,
        false, camera.viewMatrix,
    )
    gl.uniform3f(
        programInfo.uniformLocations.viewVector,
        ...camera.location.asArray())
    const dir = camera.direction()
    gl.uniform3f(
        programInfo.uniformLocations.cameraPosition, ...dir.asArray())

    gl.uniform3f(
        programInfo.uniformLocations.lightDirection, ...window.lightDirection)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, programInfo.hdri)
    gl.uniform1i(programInfo.uniformLocations.hdri, 0)

    programInfo.meshes.forEach(me => {
        const r = me.rotation

        const translation = mat4.create()
        mat4.identity(translation)
        const interp_location = vec3.create()
        vec3.lerp(interp_location, [0, 0, 1], [0, 0, 0], easeInOutElastic(state.scenes.get(IntroScene.type).n))

        mat4.translate(translation, translation, me.location)
        mat4.translate(translation, translation, interp_location)

        const rotation = mat4.create()
        mat4.identity(rotation)
        const rqt = [r[3], r[2], r[1], r[0]]
        mat4.fromQuat(rotation, rqt)

        mat4.mul(modelMatrix, translation, rotation)

        const r2 = mat4.create()
        mat4.identity(r2)
        const rqt2 = quat.create()
        quat.identity(rqt2)

        quat.rotateX(rqt2, rqt2, random_rotation[0] + rot.y * 0.1)
        quat.rotateY(rqt2, rqt2, random_rotation[1] + rot.x * 0.1)
        quat.rotateZ(rqt2, rqt2, random_rotation[2])

        mat4.fromQuat(r2, rqt2)

        const origin = [-me.location[0], -me.location[1], -me.location[2]]
        mat4.fromRotationTranslationScaleOrigin(r2, rqt2, [0, 0, 0], [1, 1, 1], origin)

        mat4.mul(modelMatrix, modelMatrix, r2)

        gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelMatrix,
            false, modelMatrix,
        )

        const diffuse = me.material.diffuse
        gl.uniform3f(programInfo.uniformLocations.baseColor, ...diffuse)

        me.gpuMesh.draw()
    })

    gl.disable(gl.DEPTH_TEST)
}

let lastTime = 0

const tick = (time = 0) => {
    const deltaTime = time - lastTime
    state.tick()

    draw(deltaTime)

    requestAnimationFrame(tick)
    lastTime = time
}

const main = () => {
    const segmenter = new Intl.Segmenter({ granularity: "letter" })
    document.querySelectorAll(".text-effect").forEach(div => {
        div.innerHTML = Array.from(segmenter.segment(div.innerHTML))
            .map(s => s.segment === ' ' ? "&nbsp;" : s.segment)
            .map((s, i) => `<span style="--n: ${i}" data-text="${s}">${s}</span>`)
            .join('')
    })

    const canvas = document.getElementById("screen")
    initContext(canvas)
    renderer = new Renderer()

    state.addScene(IntroScene.type, new IntroScene())
    state.addScene(OrbitScene.type, new OrbitScene())

    const resize = (window) => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        renderer.camera.resize(canvas.width, canvas.height)
    }

    resize(window)
    window.addEventListener('resize', e => resize(e.target))
    window.lightDirection = [0.2, -0.25, -1];

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource)
    programInfo = {
        program: shaderProgram,
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
            viewVector: gl.getUniformLocation(shaderProgram, "uViewVector"),
            cameraPosition: gl.getUniformLocation(shaderProgram, "uCameraPosition"),
            modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
            baseColor: gl.getUniformLocation(shaderProgram, "uDiffuseColor"),
            hdri: gl.getUniformLocation(shaderProgram, "uHdri"),
            lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
        },
        gpuMeshes: [],
        size: 0,
    }

    Promise.all([loadModel("assets/switch.json"), loadEnvTexture(gl, "assets/studio_small_08_1k.hdr")])
        .then(([meshes, hdri]) => {
            programInfo.hdri = hdri;
            programInfo.meshes = meshes.map(rmesh => {
                const mesh = new Mesh(
                    rmesh.transform.location,
                    rmesh.transform.rotation,
                    rmesh.vertices,
                    rmesh.normals,
                    rmesh.indices)

                mesh.material = new Material(rmesh.material.color)
                return mesh
            })

            tick()
        })

}

window.onload = main
