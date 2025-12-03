import { backend } from "./context.js"
import { TimeStampQuery } from "./query.js"

class GPUTimer {
  constructor() {
    this.timings = new Map()
    this.depth = 0
  }

  getQuery(name) {
    if (this.timings.has(name)) {
      return this.timings.get(name).queryObj
    }

    const queryObj = new TimeStampQuery()
    this.timings.set(name, { queryObj, depth: this.depth })
    return queryObj
  }

  with(name, f) {
    if (!backend.timerEXT) {
      f()
      return
    }

    const queryObj = this.getQuery(name)
    queryObj.begin()
    this.depth++
    f()
    this.depth--
    queryObj.end()
  }

  getTime(name) {
    this.getQuery(name).ready()
  }

  getAllTimings() {
    if (!backend.timerEXT) {
      return
    }

    for (const [name, _] of this.timings) {
      this.getTime(name)
    }
  }
}

class CPUTimer {
  constructor() {
    this.timings = new Map()
  }

  with(name, f) {
    const begin = performance.now()
    f()
    const t = performance.now() - begin
    this.timings.set(name, t)
  }
}

export default class DeviceTimer {
  constructor() {
    this.gpuTimer = new GPUTimer()
    this.cpuTimer = new CPUTimer()
  }

  with(name, f) {
    this.withCPU(name, () => this.withGPU(name, f))
  }

  withGPU(name, f) {
    this.gpuTimer.with(name, f)
  }

  withCPU(name, f) {
    this.cpuTimer.with(name, f)
  }
}
