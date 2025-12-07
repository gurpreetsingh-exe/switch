import { backend, gl } from "./context.js"

export const PERSISTENT = Symbol("PERSISTENT")

class Action {
  constructor(kind) {
    this.kind = kind
    this.reset()
  }

  tick(_deltaTime) {
    throw new Error("cannot call `tick()` on abstract class `Action`")
  }

  isPlaying() {
    throw new Error("cannot call `isPlaying()` on abstract class `Action`")
  }

  reset() {
    throw new Error("cannot call `reset()` on abstract class `Action`")
  }
}

export class ActionManager {
  constructor() {
    this.actions = new Map()
    this.activeActions = new Set()
    this.persistentActions = new Set()
  }

  addAction(name, action) {
    if (action.kind === PERSISTENT) {
      this.persistentActions.add(name)
    }
    this.actions.set(name, action)
  }

  play(name) {
    this.activeActions.add(name)
  }

  tick(deltaTime) {
    this.persistentActions.forEach(name => {
      this.actions.get(name).tick(deltaTime)
    })

    if (this.activeActions.size === 0) {
      return
    }

    const finished = new Set()
    this.activeActions.forEach(name => {
      const action = this.actions.get(name)
      if (action.isPlaying()) {
        action.tick(deltaTime)
      } else {
        action.reset()
        finished.add(name)
      }
    })

    this.activeActions = this.activeActions.difference(finished)
  }
}

export class KeyframeAction extends Action {
  constructor(keyframes) {
    super()
    this.keyframes = keyframes
    this.duration = this.keyframes.length
  }

  tick() {
    this.n = this.keyframes[this.currentFrame % this.duration]
    this.currentFrame += 1
  }

  isPlaying = () => this.currentFrame < this.duration

  reset() {
    this.currentFrame = 0
    this.n = null
  }
}

const easeInOutElastic = x => {
  const c5 = (2 * Math.PI) / 4.5

  return x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1
}

export class IntroAction extends Action {
  constructor() {
    super()
    this.fac = 0.35
    this.n = 0.35
  }

  tick() {
    this.fac += 0.002
    this.n = easeInOutElastic(this.fac)
  }

  isPlaying = () => this.fac <= 1

  reset() {}
}

export class OrbitAction extends Action {
  constructor() {
    super(PERSISTENT)
    if (backend.isMobile) {
      let lastExecution = 0
      window.addEventListener("deviceorientation", e => {
        const now = Date.now()
        if (now - lastExecution < 1000 / 60) {
          return
        }
        lastExecution = now

        const x = (Math.PI / 180) * e.gamma
        const y = (Math.PI / 180) * (e.beta - 25)
        const unit = Math.PI * 2
        this.rot.x = x * unit
        this.rot.y = y * unit
      })
    } else {
      window.addEventListener("mousemove", e => {
        const halfWidth = gl.canvas.clientWidth / 2
        const halfHeight = gl.canvas.clientHeight / 2
        const x = e.clientX - halfWidth
        const y = e.clientY - halfHeight
        const unit = 1
        this.rot.x = (x / halfWidth) * unit
        this.rot.y = (y / halfHeight) * unit
      })
    }
  }

  tick() {}
  isPlaying = () => true
  reset() {
    this.rot = { x: 0, y: 0 }
  }
}
