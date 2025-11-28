import { Shader } from "./shader.js"
import Material from "./material.js"
import { loadModel } from "./loaders.js"
import { loadEnvTexture } from "./texture.js"
import { gl, initContext } from "./context.js"
import State from "./state.js"
import { IntroScene, OrbitScene } from "./scene.js"
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
// const random_rotation = [0, 0, 0];
let progress = 0

const draw = _deltaTime => {
  // gl.clearColor(0.1, 0.1, 0.1, 1.0)
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
    programInfo.shader.uniformSampler(
      "uHdri",
      gl.TEXTURE_CUBE_MAP,
      programInfo.hdri,
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
        easeInOutElastic(state.scenes.get(IntroScene.type).n),
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
  renderer = new Renderer()

  state.addScene(IntroScene.type, new IntroScene())
  state.addScene(OrbitScene.type, new OrbitScene())

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
    loadModel("assets/sphere.json"),
    loadEnvTexture(gl, "assets/studio_small_08_1k.hdr"),
  ])
    .then(([vertex, fragment, meshes, hdri]) =>
      Promise.all([vertex.text(), fragment.text(), meshes, hdri]),
    )
    .then(([vertex, fragment, meshes, hdri]) => {
      programInfo = {
        shader: new Shader({ vertex, fragment }),
        meshes: meshes.map(rmesh => {
          const mesh = new Mesh(
            rmesh.transform.location,
            rmesh.transform.rotation,
            rmesh.vertices,
            rmesh.normals,
            rmesh.indices,
          )

          const mat = rmesh.material
          mesh.material = new Material(
            Vector3.fromArray(mat.color),
            mat.roughness,
            mat.metallic,
          )
          return mesh
        }),
        gpuMeshes: [],
        hdri,
        size: 0,
      }

      tick()
    })
}

window.onload = main
