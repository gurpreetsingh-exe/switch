import { Shader } from "./shader.js"
import Material from "./material.js"
import { loadModel } from "./loaders.js"
import {
  generateIrradiance,
  generatePrefilter,
  loadCubeMapShader,
  Texture,
  Texture2D,
  TextureCubeMap,
} from "./texture.js"
import { backend, gl, initContext } from "./context.js"
import State from "./state.js"
import { IntroAction, OrbitAction } from "./action.js"
import Mesh from "./mesh.js"
import Renderer from "./renderer.js"
import { Vector3 } from "./math.js"

let programInfo = null
const state = new State()
let renderer = null

const rot = { x: 0, y: 0 }

const easeInOutElastic = x => {
  const c5 = (2 * Math.PI) / 4.5

  return x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1
}

const random_rotation = [-1, 0.5, 0]
// const random_rotation = [0, 0, 0]
let progress = 0

const generatePrecompBrdf = (brdfShader, size) => {
  const brdfLUTTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, brdfLUTTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RG16F,
    size,
    size,
    0,
    gl.RG,
    gl.FLOAT,
    null,
  )

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.bindTexture(gl.TEXTURE_2D, brdfLUTTexture)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    brdfLUTTexture,
    0,
  )
  gl.bindTexture(gl.TEXTURE_2D, brdfLUTTexture)
  const fbstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (fbstatus !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`framebuffer status not complete: ${fbstatus}`)
  }

  brdfShader.with(() => {
    gl.viewport(0, 0, size, size)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  })

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.deleteFramebuffer(fbo)

  return new Texture(Texture2D, size, size, brdfLUTTexture)
}

const draw = _deltaTime => {
  gl.clearColor(0, 0, 0, 0)
  gl.clearDepth(1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const modelMatrix = mat4.create()

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  gl.useProgram(programInfo.program)
  programInfo.shader.with(() => {
    const camera = renderer.camera
    programInfo.shader.uniformMat4("uProjectionMatrix", camera.projectionMatrix)
    programInfo.shader.uniformMat4("uViewMatrix", camera.viewMatrix)
    programInfo.shader.uniformVec3("uViewVector", camera.location)
    programInfo.shader.uniformVec3("uCameraPosition", camera.direction())
    programInfo.shader.uniformVec3("uLightDirection", window.lightDirection)
    programInfo.shader.uniformSampler("uIrradiance", programInfo.irradiance)
    programInfo.shader.uniformSampler("uPrefilter", programInfo.prefilter)
    programInfo.shader.uniformSampler("uBrdfLUT", programInfo.brdfLut)
    programInfo.shader.uniformFloat(
      "uMaxMipLevel",
      Math.floor(backend.maxMipLevel * 0.5) - 1.0,
    )

    programInfo.meshes.forEach(me => {
      const r = me.rotation
      const translation = mat4.create()
      mat4.identity(translation)
      const interp_location = vec3.create()
      vec3.lerp(
        interp_location,
        [0, 0, 1],
        [0, 0, 0],
        easeInOutElastic(state.actions.get(IntroAction.type).n),
      )

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
      mat4.fromRotationTranslationScaleOrigin(
        r2,
        rqt2,
        [0, 0, 0],
        [1, 1, 1],
        origin,
      )

      mat4.mul(modelMatrix, modelMatrix, r2)

      programInfo.shader.uniformMat4("uModelMatrix", modelMatrix)

      const m = me.material
      programInfo.shader.uniformVec3("uDiffuseColor", m.diffuse)
      programInfo.shader.uniformFloat("uRoughness", m.roughness)
      programInfo.shader.uniformFloat("uMetallic", m.metallic)

      me.gpuMesh.draw()
    })

    gl.disable(gl.DEPTH_TEST)
  })
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
      .map(s => (s.segment === " " ? "&nbsp;" : s.segment))
      .map((s, i) => `<span style="--n: ${i}" data-text="${s}">${s}</span>`)
      .join("")
  })

  const canvas = document.getElementById("screen")
  initContext(canvas)
  loadCubeMapShader().then(() => {})

  renderer = new Renderer()

  state.addAction(IntroAction.type, new IntroAction())
  state.addAction(OrbitAction.type, new OrbitAction())

  const resize = window => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    renderer.camera.resize(canvas.width, canvas.height)
  }

  resize(window)
  window.addEventListener("resize", e => resize(e.target))

  window.addEventListener("mousemove", e => {
    const halfWidth = canvas.width / 2
    const halfHeight = canvas.height / 2
    const x = e.clientX - halfWidth
    const y = e.clientY - halfHeight
    const unit = 1
    rot.x = (x / halfWidth) * unit
    rot.y = (y / halfHeight) * unit
  })

  document.addEventListener("wheel", e => {
    progress -= e.wheelDelta / 100
    progress = Math.max(Math.min(progress, 100), 0)
  })

  window.lightDirection = new Vector3(0.2, -0.25, -1)

  Promise.all([
    fetch("shaders/vertex.glsl"),
    fetch("shaders/fragment.glsl"),
    fetch("shaders/fs_quad.glsl"),
    fetch("shaders/brdf_precomp.glsl"),
    loadModel("assets/switch.json"),
    Texture.create({
      kind: TextureCubeMap,
      width: 1000,
      height: 1000,
      url: "assets/studio_small_08_1k.hdr",
    }),
  ])
    .then(([vertex, fragment, fs, brdfPrecomp, meshes, hdri]) =>
      Promise.all([
        vertex.text(),
        fragment.text(),
        fs.text(),
        brdfPrecomp.text(),
        meshes,
        hdri,
      ]),
    )
    .then(([vertex, fragment, fs, brdfPrecomp, meshes, hdri]) => {
      const brdfShader = new Shader({ vertex: fs, fragment: brdfPrecomp })

      programInfo = {
        shader: new Shader({ vertex, fragment }),
        meshes: meshes.map(
          rmesh =>
            new Mesh(
              rmesh.transform.location,
              rmesh.transform.rotation,
              rmesh.vertices,
              rmesh.normals,
              rmesh.indices,
              new Material(
                Vector3.fromArray(rmesh.material.color),
                rmesh.material.roughness,
                rmesh.material.metallic,
              ),
            ),
        ),
        gpuMeshes: [],
        irradiance: generateIrradiance(hdri, 32),
        prefilter: generatePrefilter(hdri, 128),
        brdfLut: generatePrecompBrdf(brdfShader, 512),
        size: 0,
      }

      tick()
    })
}

window.onload = main
