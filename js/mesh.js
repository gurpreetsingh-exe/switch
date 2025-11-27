import { gl } from "./context.js"
import GPUBatch from "./batch.js"
import Material from "./material.js"

export default class Mesh {
  constructor(location, rotation, vertices, normals, indices) {
    this.location = location
    this.rotation = rotation
    this.gpuMesh = new GPUBatch(
      [
        {
          target: gl.ARRAY_BUFFER,
          numberOfElements: 3,
          bufferData: new Float32Array(vertices),
          dataType: gl.FLOAT,
        },
        {
          target: gl.ARRAY_BUFFER,
          numberOfElements: 3,
          bufferData: new Float32Array(normals),
          dataType: gl.FLOAT,
        },
      ],
      indices,
    )
    this.material = new Material()
  }
}
