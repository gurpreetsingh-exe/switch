import GPUBuffer from "./buffer.js"
import { gl } from "./context.js"

export default class GPUBatch {
  #id

  constructor(bufferLayoutList, indices = []) {
    this.#id = gl.createVertexArray()
    this.bind()

    this.vertexBuffers = []
    this.indexBuffer = null
    this.size = 0
    bufferLayoutList.forEach(bufferLayout => this.addBuffer(bufferLayout))
    if (indices.length === 0) {
      this.size = this.vertexBuffers[0].size
      return
    }

    const indexBuffer = new GPUBuffer(gl.ELEMENT_ARRAY_BUFFER)
    indexBuffer.write(new Uint16Array(indices))
    this.indexBuffer = indexBuffer
    this.size = this.indexBuffer.size

    this.unbind()
  }

  bind = () => gl.bindVertexArray(this.#id)
  unbind = () => gl.bindVertexArray(null)

  addBuffer(bufferLayout) {
    const buffer = new GPUBuffer(bufferLayout.target)
    buffer.write(bufferLayout.bufferData)
    gl.vertexAttribPointer(
      this.vertexBuffers.length,
      bufferLayout.numberOfElements,
      bufferLayout.dataType,
      false,
      0,
      null,
    )
    gl.enableVertexAttribArray(this.vertexBuffers.length)
    this.vertexBuffers.push(buffer)
  }

  draw() {
    this.bind()
    gl.drawElements(gl.TRIANGLES, this.size, gl.UNSIGNED_SHORT, 0)
  }
}
