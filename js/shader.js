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
  constructor() {
    this.epilogue = "#version 300 es\nprecision highp float;\n"
    this.defines = []
  }

  define(name, value) {
    this.defines.push(`#define ${name} ${value}`)
  }

  generate(src) {
    return `${this.epilogue}\n${this.defines.join("\n")}\n${src}`
  }
}

const compiler = new ShaderCompiler()
compiler.define("MATH_PI", "3.1415926535897932384626433832795")
compiler.define("MATH_INV_PI", "(1.0 / MATH_PI)")

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
    this.#id = initShaderProgram(
      gl,
      compiler.generate(info.vertex),
      compiler.generate(info.fragment),
    )
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
