import { initShaderProgram } from './shader.js'
import GPUBatch from './batch.js'
import { Vector3 } from './math.js'
import { loadModel, loadTexture } from './loaders.js'
import { gl, initContext } from './context.js'

const INTRO = Symbol("INTRO")
const ORBIT = Symbol("ORBIT")

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

    void main() {
        vec3 P = v_position;
        vec3 N = v_normal;
        vec3 lightPosition = vec3(-10, 10, -10);
        float diffuse = max(dot(N, normalize(v_position - lightPosition)), 0.0);
        // vec2 uv = vec2(atan(P.y, P.x) / 3.14, P.z) * 0.5 + 0.5;
        // vec3 baseColor = texture(uTexture, uv).rgb;
        // vec3 color = mix(baseColor * 0.04, baseColor, smoothstep(0.0, 1.0, diffuse));
        vec3 baseColor = vec3(0.9, 0.1, 0.1);
        vec3 color = mix(baseColor * 0.04, baseColor, smoothstep(0.0, 1.0, diffuse));
        color = 0.5 + 0.5 * N;
        FragColor = vec4(pow(color, vec3(0.4545)), 1.0);
    }
  `

//    The following more or less comes from:
//    http://vered.rose.utoronto.ca/people/david_dir/GEMS/GEMS.html
//
//    //Pitch->X axis, Yaw->Y axis, Roll->Z axis
//    Quaternion::Quaternion(float fPitch, float fYaw, float fRoll)
//    {
//       const float fSinPitch(sin(fPitch*0.5F));
//       const float fCosPitch(cos(fPitch*0.5F));
//       const float fSinYaw(sin(fYaw*0.5F));
//       const float fCosYaw(cos(fYaw*0.5F));
//       const float fSinRoll(sin(fRoll*0.5F));
//       const float fCosRoll(cos(fRoll*0.5F));
//       const float fCosPitchCosYaw(fCosPitch*fCosYaw);
//       const float fSinPitchSinYaw(fSinPitch*fSinYaw);
//
//       X = fSinRoll * fCosPitchCosYaw     - fCosRoll * fSinPitchSinYaw;
//       Y = fCosRoll * fSinPitch * fCosYaw + fSinRoll * fCosPitch * fSinYaw;
//       Z = fCosRoll * fCosPitch * fSinYaw - fSinRoll * fSinPitch * fCosYaw;
//       W = fCosRoll * fCosPitchCosYaw     + fSinRoll * fSinPitchSinYaw;
//    }


// quaternion to rotation matrix
//    xx      = X * X;
//    xy      = X * Y;
//    xz      = X * Z;
//    xw      = X * W;
//
//    yy      = Y * Y;
//    yz      = Y * Z;
//    yw      = Y * W;
//
//    zz      = Z * Z;
//    zw      = Z * W;
//
//    mat[0]  = 1 - 2 * ( yy + zz );
//    mat[1]  =     2 * ( xy - zw );
//    mat[2]  =     2 * ( xz + yw );
//
//    mat[4]  =     2 * ( xy + zw );
//    mat[5]  = 1 - 2 * ( xx + zz );
//    mat[6]  =     2 * ( yz - xw );
//
//    mat[8]  =     2 * ( xz - yw );
//    mat[9]  =     2 * ( yz + xw );
//    mat[10] = 1 - 2 * ( xx + yy );
//
//    mat[3]  = mat[7] = mat[11] = mat[12] = mat[13] = mat[14] = 0;
//    mat[15] = 1;


// rotation to matrix
//    A       = cos(angle_x);
//    B       = sin(angle_x);
//    C       = cos(angle_y);
//    D       = sin(angle_y);
//    E       = cos(angle_z);
//    F       = sin(angle_z);
//
//    AD      =   A * D;
//    BD      =   B * D;
//
//    mat[0]  =   C * E;
//    mat[1]  =  -C * F;
//    mat[2]  =   D;
//    mat[4]  =  BD * E + A * F;
//    mat[5]  = -BD * F + A * E;
//    mat[6]  =  -B * C;
//    mat[8]  = -AD * E + B * F;
//    mat[9]  =  AD * F + B * E;
//    mat[10] =   A * C;
//
//    mat[3]  =  mat[7] = mat[11] = mat[12] = mat[13] = mat[14] = 0;
//    mat[15] =  1;

let programInfo = null
let angle = 0
let mode = INTRO
let x = 0.35

const rot = { x: 0, y: 0 }

const easeInOutBack = (x) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525

    return x < 0.5
        ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
        : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
}

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

const r = () => Math.random() * Math.PI * 2
const random_rotation = [-1, 0.5, 0]

window.addEventListener('mousemove', e => {
    const halfWidth = (gl.canvas.width / 2)
    const halfHeight = (gl.canvas.height / 2)
    const x = e.clientX - halfWidth
    const y = e.clientY - halfHeight
    rot.x = x / halfWidth
    rot.y = y / halfHeight
})

document.addEventListener('wheel', e => {
    console.log(e)
})

const draw = (_deltaTime) => {
    gl.clearColor(0.1, 0.1, 0.1, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const fieldOfView = (35 * Math.PI) / 180
    const aspect = gl.canvas.width / gl.canvas.height
    const zNear = 0.01
    const zFar = 100.0
    // const ro = new Vector3(10, 10, 2)
    const ro = new Vector3(0, 2, 0)
    const target = Vector3.fromScalar(0)
    const up = new Vector3(0, 0, 1)
    const projectionMatrix = mat4.create()
    const viewMatrix = mat4.create()
    const modelMatrix = mat4.create()
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar)
    mat4.lookAt(viewMatrix, ro.asArray(), target.asArray(), up.asArray())
    angle += (0.18 * Math.PI) / 180

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    gl.useProgram(programInfo.program)

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false, projectionMatrix,
    )
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.viewMatrix,
        false, viewMatrix,
    )

    gl.bindTexture(gl.TEXTURE_2D, programInfo.texture)
    gl.uniform1i(programInfo.uniformLocations.texture, 0)

    programInfo.meshes.forEach(me => {
        const r = me.rotation

        const translation = mat4.create()
        mat4.identity(translation)
        const interp_location = vec3.create()
        vec3.lerp(interp_location, [0, 0, 1], [0, 0, 0], easeInOutElastic(x))

        mat4.translate(translation, translation, me.location)
        mat4.translate(translation, translation, interp_location)

        const rotation = mat4.create()
        mat4.identity(rotation)
        const rqt = [r[3], r[2], r[1], r[0]]
        // quat.rotateZ(rqt, rqt, angle)
        mat4.fromQuat(rotation, rqt)

        mat4.mul(modelMatrix, translation, rotation)

        const r2 = mat4.create()
        mat4.identity(r2)
        const rqt2 = quat.create()
        quat.identity(rqt2)
        // quat.rotateZ(rqt2, rqt2, angle)

        quat.rotateX(rqt2, rqt2, random_rotation[0] + rot.y * 0.1)
        quat.rotateY(rqt2, rqt2, random_rotation[1] + rot.x * 0.1)
        quat.rotateZ(rqt2, rqt2, random_rotation[2])

        // quat.rotateX(rqt2, rqt2, x)

        mat4.fromQuat(r2, rqt2)

        const origin = [-me.location[0], -me.location[1], -me.location[2]]
        mat4.fromRotationTranslationScaleOrigin(r2, rqt2, [0, 0, 0], [1, 1, 1], origin)

        mat4.mul(modelMatrix, modelMatrix, r2)

        gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelMatrix,
            false, modelMatrix,
        )

        me.gpuMesh.draw()
    })

    gl.disable(gl.DEPTH_TEST)

    // programInfo.cubemapMesh.draw()
}

let lastTime = 0

const tick = (time = 0) => {
    const deltaTime = time - lastTime
    if (mode === INTRO) {
        // x += 0.0001 * deltaTime
        x += 0.002
    }

    if (x >= 1.0) {
        mode = ORBIT
    }

    draw(deltaTime)

    requestAnimationFrame(tick)
    lastTime = time
}

class Mesh {
    constructor(location, rotation, vertices, normals, indices) {
        this.location = location
        this.rotation = rotation
        this.gpuMesh = new GPUBatch([
            {
                target: gl.ARRAY_BUFFER,
                numberOfElements: 3,
                bufferData: new Float32Array(vertices),
                dataType: gl.FLOAT,
            },
            {
                target: gl.ARRAY_BUFFER,
                numberOfElements: 3,
                bufferData: new Float32Array(normals),
                dataType: gl.FLOAT,
            },
        ], indices)
    }
}

const main = () => {
    const canvas = document.getElementById("screen")
    initContext(canvas)

    const resize = (window) => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
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
            texture: gl.getUniformLocation(shaderProgram, "uTexture"),
        },
        gpuMeshes: [],
        size: 0,
        texture: null,
        cubemapMesh: new GPUBatch([
            {
                target: gl.ARRAY_BUFFER,
                numberOfElements: 3,
                bufferData: new Float32Array([-1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0]),
                dataType: gl.FLOAT,
            }
        ], [0, 1, 3, 0, 3, 2, 2, 3, 7, 2, 7, 6, 6, 7, 5, 6, 5, 4, 4, 5, 1, 4, 1, 0, 2, 6, 4, 2, 4, 0, 7, 3, 1, 7, 1, 5]),
    }

    // Promise.all([loadModel("assets/mesh.json"), loadTexture(gl, "assets/moon_texture.jpg")])
    //     .then(([mesh, texture]) => {
    //         programInfo.size = mesh.indices.length
    //         programInfo.texture = texture
    //         programInfo.gpuMesh = new GPUBatch([
    //             {
    //                 target: gl.ARRAY_BUFFER,
    //                 numberOfElements: 3,
    //                 bufferData: new Float32Array(mesh.vertices),
    //                 dataType: gl.FLOAT,
    //             }
    //         ], mesh.indices)

    //         tick()
    //     })


    Promise.all([loadModel("assets/switch.json"), loadTexture(gl, "assets/moon_texture.jpg")])
        .then(([meshes, texture]) => {
            // const vertices = [].concat(...meshes.map(m => m.vertices))
            // console.log(vertices)
            // let indices = []
            // let start = 0
            // meshes.forEach(m => {
            //     indices = indices.concat(m.indices.map(i => i + start))
            //     start += m.vertices.length
            // })
            // console.log(indices)

            programInfo.texture = texture
            programInfo.meshes = meshes.map(mesh => new Mesh(
                mesh.transform.location,
                mesh.transform.rotation,
                mesh.vertices,
                mesh.normals,
                mesh.indices)
            )

            tick()
        })

}

window.onload = main
