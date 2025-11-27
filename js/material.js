import { Vector3 } from "./math.js"

export default class Material {
  constructor(diffuse = new Vector3(1, 1, 1)) {
    this.diffuse = diffuse
  }
}
