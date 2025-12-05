/** @type {WebGL2RenderingContext} */
export let gl = null
export let backend = null
export const initContext = canvas => {
  gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
  const ext = gl.getExtension("EXT_color_buffer_float")
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  const maxUniformBufferSize = gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE)
  backend = {
    maxTextureSize,
    maxMipLevel: Math.floor(Math.log2(maxTextureSize)),
    supportedExtensions: gl.getSupportedExtensions(),
    maxUniformBufferSize: `${Math.floor(maxUniformBufferSize / 1024)}KB`,
    timerEXT: gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    // https://stackoverflow.com/a/29509267
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  }
  console.log(backend)
}
