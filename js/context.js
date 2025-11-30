/** @type {WebGL2RenderingContext} */
export let gl = null
export let backend = null
export const initContext = canvas => {
  gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
  const ext = gl.getExtension("EXT_color_buffer_float")
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  backend = {
    maxTextureSize,
    maxMipLevel: Math.floor(Math.log2(maxTextureSize)),
    supportedExtensions: gl.getSupportedExtensions(),
  }
  console.log(backend)
}
