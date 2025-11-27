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
  }
}
