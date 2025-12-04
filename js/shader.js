import GPUBuffer from "./buffer.js"
import { gl } from "./context.js"

/**
 * @param {WebGL2RenderingContext} gl
 */
export const initShaderProgram = (gl, vsSource, fsSource) => {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram,
      )}`,
    )
    return null
  }
  return shaderProgram
}

class ShaderCompiler {
  constructor(mathDefines = false) {
    this.epilogue = "#version 300 es\nprecision mediump float;\n"
    this.defines = []
    this.uniformBlocks = []
    if (mathDefines) {
      this.addMathDefines()
    }
  }

  addMathDefines() {
    this.define("MATH_PI", "3.1415926535897932384626433832795")
    this.define("MATH_INV_PI", "(1.0 / MATH_PI)")
  }

  uniformBlock(name, values) {
    const struct = values
      .map(({ name, type }) => `  ${type} ${name};`)
      .join("\n")
    this.uniformBlocks.push(`uniform ${name} \{\n${struct}\n\};`)
  }

  define(name, value) {
    this.defines.push(`#define ${name} ${value}`)
  }

  generate(src) {
    const f = v => (v.length > 0 ? v.join("\n") + "\n\n" : "")
    const ubs = f(this.uniformBlocks)
    const defs = f(this.defines)
    return `${this.epilogue}\n${ubs}${defs}${src}`
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 */
export const loadShader = (gl, type, source) => {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`,
    )
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export class Shader {
  #id

  constructor(info) {
    this.uniformBlockInfo = new Map()
    const compiler = new ShaderCompiler(true)
    if (info.defines) {
      info.defines.forEach(({ name, value }) => {
        compiler.define(name, value)
      })
    }
    if (info.uniformBlocks) {
      info.uniformBlocks.forEach(block => {
        compiler.uniformBlock(block.name, block.members)
      })
    }
    this.#id = initShaderProgram(
      gl,
      compiler.generate(info.vertex),
      compiler.generate(info.fragment),
    )

    if (info.uniformBlocks) {
      info.uniformBlocks.forEach(block => {
        const uniformBlockInfo = {}
        const blockInfo = this.createUniformBlockInfo(block.name)
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, blockInfo.buffer.id)
        const uniformVarNames = block.members.map(({ name }) => name)
        const uniformIndices = gl.getUniformIndices(this.#id, uniformVarNames)
        const uniformOffsets = gl.getActiveUniforms(
          this.#id,
          uniformIndices,
          gl.UNIFORM_OFFSET,
        )

        uniformVarNames.forEach((name, index) => {
          uniformBlockInfo[name] = {
            index: uniformIndices[index],
            offset: uniformOffsets[index],
          }
        })

        uniformBlockInfo.uniformBuffer = blockInfo.buffer
        uniformBlockInfo.index = blockInfo.index
        gl.uniformBlockBinding(this.#id, blockInfo.index, block.binding)
        this.uniformBlockInfo.set(block.name, uniformBlockInfo)
      })
    }

    this.uniforms = new Map()
    this.boundSamplers = 0
  }

  getUniformLocation(name) {
    if (this.uniforms.has(name)) {
      return this.uniforms.get(name)
    }

    const location = gl.getUniformLocation(this.#id, name)
    this.uniforms.set(name, location)
    return location
  }

  createUniformBlockInfo(name) {
    const blockIndex = gl.getUniformBlockIndex(this.#id, name)
    const blockSize = gl.getActiveUniformBlockParameter(
      this.#id,
      blockIndex,
      gl.UNIFORM_BLOCK_DATA_SIZE,
    )

    const info = {
      buffer: new GPUBuffer(gl.UNIFORM_BUFFER, blockSize),
      index: blockIndex,
    }
    return info
  }

  with = f => {
    gl.useProgram(this.#id)
    f()
    gl.useProgram(null)
    this.boundSamplers = 0
  }

  uniformInt(name, v) {
    gl.uniform1i(this.getUniformLocation(name), v)
  }

  uniformFloat(name, v) {
    gl.uniform1f(this.getUniformLocation(name), v)
  }

  uniformVec3(name, v) {
    gl.uniform3f(this.getUniformLocation(name), ...v.asArray())
  }

  uniformMat4(name, v) {
    gl.uniformMatrix4fv(this.getUniformLocation(name), false, v)
  }

  uniformSampler(name, v) {
    gl.activeTexture(gl.TEXTURE0 + this.boundSamplers)
    gl.bindTexture(v.target, v.id)
    this.uniformInt(name, this.boundSamplers)
    this.boundSamplers++
  }
}
