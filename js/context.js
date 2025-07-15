/** @type {WebGL2RenderingContext} */
export let gl = null;
export const initContext = (canvas) =>
    gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
