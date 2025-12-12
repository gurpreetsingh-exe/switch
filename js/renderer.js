import { Vector3 } from "./math.js"
import Camera from "./camera.js"
import { gl } from "./context.js"

export default class Renderer {
  constructor() {
    this.camera = new Camera(
      new Vector3(0, 2, 0),
      Vector3.fromScalar(0),
      (35 * Math.PI) / 180,
      gl.canvas.width / gl.canvas.height,
      0.01,
      100.0,
    )

    gl.depthFunc(gl.LEQUAL)
  }

  resize() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  clear() {
    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1.0)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  }
}
