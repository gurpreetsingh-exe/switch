export class Vector3 {
  constructor(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  static fromScalar = t => new Vector3(t, t, t)
  static fromArray = t => new Vector3(...t)
  div = v => new Vector3(this.x / v.x, this.y / v.y, this.z / v.z)
  sub = v => new Vector3(this.x - v.x, this.y - v.y, this.z - v.z)
  normalize = () => this.div(Vector3.fromScalar(this.length()))
  length = () => this.x * this.x + this.y * this.y + this.z * this.z
  cross = v =>
    new Vector3(
      this.y * v.z - v.y * this.z,
      this.z * v.x - v.z * this.x,
      this.x * v.y - v.x * this.y,
    )
  asArray = () => [this.x, this.y, this.z]
}
