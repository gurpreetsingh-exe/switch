import { Vector3 } from "./math.js"

export default class Material {
  constructor(diffuse = new Vector3(1, 1, 1), roughness = 0.5, metallic = 0) {
    this.diffuse = diffuse
    this.roughness = roughness
    this.metallic = metallic
  }
}
