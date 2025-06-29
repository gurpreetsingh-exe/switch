import { initShaderProgram } from './shader.js'
import { initBuffer } from './buffer.js'
import { Vector3 } from './math.js'
import { loadModel, loadTexture } from './loaders.js'

const vsSource = `#version 300 es
    precision highp float;

    in vec3 aVertexPosition;
    out vec3 v_position;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main() {
        v_position = aVertexPosition;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 1.0);
    }
  `

const fsSource = `#version 300 es
    precision highp float;

    in vec3 v_position;
    out vec4 FragColor;

    uniform sampler2D uTexture;

    void main() {
        vec3 P = normalize(v_position);
        vec3 lightPosition = vec3(-10, 10, -10);
        float diffuse = max(dot(P, normalize(v_position - lightPosition)), 0.0);
        vec2 uv = vec2(atan(P.y, P.x) / 3.14, P.z) * 0.5 + 0.5;
        vec3 baseColor = texture(uTexture, uv).rgb;
        vec3 color = mix(baseColor * 0.04, baseColor, smoothstep(0.0, 1.0, diffuse));
        FragColor = vec4(color, 1.0);
    }
  `

let programInfo = null
/** @type {WebGL2RenderingContext} */
let gl = null;

let angle = 0
const draw = (deltaTime) => {
    gl.clearColor(0.1, 0.1, 0.1, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const fieldOfView = (45 * Math.PI) / 180
    const aspect = gl.canvas.width / gl.canvas.height
    const zNear = 0.01
    const zFar = 100.0
    const ro = new Vector3(10, 10, 2)
    const target = Vector3.fromScalar(0)
    const up = new Vector3(0, 0, 1)
    const projectionMatrix = mat4.create()
    const viewMatrix = mat4.create()
    const modelMatrix = mat4.create()

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar)
    mat4.lookAt(viewMatrix, ro.asArray(), target.asArray(), up.asArray())
    mat4.rotateY(modelMatrix, modelMatrix, 0.2)
    mat4.rotateZ(modelMatrix, modelMatrix, angle)
    angle += (0.04 * Math.PI) / 180

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    gl.useProgram(programInfo.program)
    gl.bindVertexArray(programInfo.vao)

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false, projectionMatrix,
    )
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.viewMatrix,
        false, viewMatrix,
    )
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelMatrix,
        false, modelMatrix,
    )
    gl.bindTexture(gl.TEXTURE_2D, programInfo.texture)
    gl.uniform1i(programInfo.uniformLocations.texture, 0)

    gl.drawElements(gl.TRIANGLES, programInfo.size, gl.UNSIGNED_SHORT, 0)
}

let lastTime = 0

const tick = (time = 0) => {
    const deltaTime = time - lastTime
    draw(deltaTime)

    requestAnimationFrame(tick)
    lastTime = time
}

const main = () => {
    const canvas = document.getElementById("screen")
    gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))

    const resize = (window) => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    resize(window)
    window.addEventListener('resize', e => resize(e.target))

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource)
    programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
            modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
            texture: gl.getUniformLocation(shaderProgram, "uTexture"),
        },
        vao: gl.createVertexArray(),
        size: 0,
        texture: null
    }

    gl.bindVertexArray(programInfo.vao)
    Promise.all([loadModel("assets/mesh.json"), loadTexture(gl, "assets/moon_texture.jpg")])
        .then(([mesh, texture]) => {
            programInfo.size = mesh.indices.length
            programInfo.texture = texture

            const positionBuffer = initBuffer(gl, new Float32Array(mesh.vertices))
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, null)
            gl.enableVertexAttribArray(0)

            const indexBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW)
            gl.bindVertexArray(null)

            tick()
        })
}

window.onload = main
