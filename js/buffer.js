import { gl } from './context.js'

export default class GPUBuffer {
    #id
    #target

    constructor(target) {
        this.#id = gl.createBuffer()
        this.#target = target
        this.size = 0
    }

    bind = () => gl.bindBuffer(this.#target, this.#id)
    unbind = () => gl.bindBuffer(this.#target, null)

    write(bufferData) {
        gl.bindBuffer(this.#target, this.#id)
        gl.bufferData(this.#target, bufferData, gl.STATIC_DRAW)
        this.size = bufferData.length
    }
}
