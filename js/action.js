class Action {
  static type = undefined

  update() {
    throw new Error("cannot call `update()` on abstract class `Action`")
  }

  isPlaying() {
    throw new Error("cannot call `isPlaying()` on abstract class `Action`")
  }
}

export class IntroAction extends Action {
  static type = Symbol("INTRO")

  constructor() {
    super()
    this.n = 0.35
  }

  update() {
    this.n += 0.002
  }

  isPlaying = () => this.n <= 1
}

export class OrbitAction extends Action {
  static type = Symbol("ORBIT")

  constructor() {
    super()
    this.n = 0.35
  }

  update() {
    this.n += 0.002
  }

  isPlaying = () => this.n <= 1
}
