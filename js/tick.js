export class TickManager {
  constructor(tick) {
    this.tick = tick
    this.tickProxy = time => {
      this.tick(time)
      this.enqueue()
    }
  }

  enqueue() {
    requestAnimationFrame(this.tickProxy)
  }
}

export class RequestAnimationFrameTick extends TickManager {
  constructor(tick) {
    super(tick)
  }
}

const ONE_SECOND = 1000
export class ConstTick extends TickManager {
  constructor(tick, fps = 60) {
    super(tick)
    this.fps = fps
    this.deltaTime = ONE_SECOND / this.fps
    this.accumulatedTime = 0
    this.lastTime = null

    this.tickProxy = time => {
      if (this.lastTime) {
        this.accumulatedTime += time - this.lastTime

        if (this.accumulatedTime > ONE_SECOND) {
          this.accumulatedTime = ONE_SECOND
        }

        state.timer.withCPU("const-tick-proxy", () => {
          while (this.accumulatedTime > this.deltaTime) {
            this.tick(this.deltaTime)
            this.accumulatedTime -= this.deltaTime
          }
        })
      }

      this.lastTime = time
      this.enqueue()
    }
  }
}
