import { TimeStampQuery } from "./query.js"

export default class GPUTimer {
  constructor() {
    this.timings = new Map()
  }

  getQuery(name) {
    if (this.timings.has(name)) {
      return this.timings.get(name)
    }

    const queryObj = new TimeStampQuery()
    this.timings.set(name, queryObj)
    return queryObj
  }

  with(name, f) {
    const queryObj = this.getQuery(name)
    queryObj.begin()
    f()
    queryObj.end()
  }

  getTime(name) {
    this.timings.get(name).ready()
  }

  getAllTimings() {
    for (const [name, _] of this.timings) {
      this.getTime(name)
    }
  }
}
