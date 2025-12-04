import { gl } from "./context.js"

export default class GPUBuffer {
  constructor(target, size = null) {
    this.id = gl.createBuffer()
    this.target = target
    this.usage = gl.STATIC_DRAW
    if (this.target === gl.UNIFORM_BUFFER) {
      if (size === null) {
        throw new Error("size required for uniform buffer")
      }
      this.usage = gl.DYNAMIC_DRAW
      this.size = size
      this.bind()
      gl.bufferData(this.target, this.size, this.usage)
      this.unbind()
    } else {
      this.size = 0
    }
  }

  bind = () => gl.bindBuffer(this.target, this.id)
  unbind = () => gl.bindBuffer(this.target, null)

  write(bufferData) {
    gl.bindBuffer(this.target, this.id)
    gl.bufferData(this.target, bufferData, gl.STATIC_DRAW)
    this.size = bufferData.length
  }
}
