/** @type {WebGL2RenderingContext} */
export let gl = null;
export const initContext = (canvas) => {
    gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
    console.log(gl.getSupportedExtensions())
    const ext = gl.getExtension("EXT_color_buffer_float")
    if (ext === null) {
        console.log("`EXT_color_buffer_float` not supported")
    }
}
