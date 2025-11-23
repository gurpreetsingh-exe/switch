import { initShaderProgram } from './shader.js'
import Material from './material.js'
import { loadModel, loadTexture } from './loaders.js'
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
        v_position = aVertexPosition;
        v_normal = aNormal;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
    }
  `

const fsSource = `#version 300 es
    precision highp float;

    in vec3 v_position;
    in vec3 v_normal;
    out vec4 FragColor;

    uniform sampler2D uTexture;
    uniform vec3 uDiffuseColor;

    void main() {
        vec3 P = v_position;
        vec3 N = v_normal;
        vec3 lightPosition = vec3(-10, 10, -10);
        float diffuse = max(dot(N, normalize(v_position - lightPosition)), 0.0);
        vec3 baseColor = uDiffuseColor;
        vec3 color = mix(baseColor * 0.04, baseColor, smoothstep(0.0, 1.0, diffuse));
        // color = baseColor;
        FragColor = vec4(pow(color, vec3(0.4545)), 1.0);
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
let progress = 0

window.addEventListener('mousemove', e => {
    const halfWidth = (gl.canvas.width / 2)
    const halfHeight = (gl.canvas.height / 2)
    const x = e.clientX - halfWidth
    const y = e.clientY - halfHeight
    rot.x = x / halfWidth
    rot.y = y / halfHeight
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

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false, renderer.camera.projectionMatrix,
    )
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.viewMatrix,
        false, renderer.camera.viewMatrix,
    )

    gl.bindTexture(gl.TEXTURE_2D, programInfo.texture)
    gl.uniform1i(programInfo.uniformLocations.texture, 0)

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

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource)
    programInfo = {
        program: shaderProgram,
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
            modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
            baseColor: gl.getUniformLocation(shaderProgram, "uDiffuseColor"),
            texture: gl.getUniformLocation(shaderProgram, "uTexture"),
        },
        gpuMeshes: [],
        size: 0,
    }

    Promise.all([loadModel("assets/switch.json"), loadTexture(gl, "assets/moon_texture.jpg")])
        .then(([meshes, texture]) => {
            programInfo.texture = texture
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
