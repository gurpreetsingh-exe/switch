/**
  * @param {WebGL2RenderingContext} gl
  */
export const initBuffer = (gl, bufferData) => {
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW)
    return buffer
}
