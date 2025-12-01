import { gl, backend } from "./context.js"

class GPUQuery {
  begin() {
    throw new Error("cannot call `begin()` on abstract class `GPUQuery`")
  }

  end() {
    throw new Error("cannot call `end()` on abstract class `GPUQuery`")
  }

  ready() {
    throw new Error("cannot call `ready()` on abstract class `GPUQuery`")
  }
}

export class TimeElapsedQuery extends GPUQuery {
  constructor() {
    super()
    this.id = gl.createQuery()
    this.elapsedMillis = 0
  }

  begin() {
    gl.beginQuery(backend.timerEXT.TIME_ELAPSED_EXT, this.id)
  }

  end() {
    gl.endQuery(backend.timerEXT.TIME_ELAPSED_EXT)
  }

  ready() {
    const available = gl.getQueryParameter(this.id, gl.QUERY_RESULT_AVAILABLE)
    const disjoint = gl.getParameter(backend.timerEXT.GPU_DISJOINT_EXT)
    const isReady = available && !disjoint
    if (isReady) {
      const elapsedNanos = gl.getQueryParameter(this.id, gl.QUERY_RESULT)
      this.elapsedMillis = elapsedNanos / 1_000_000
    }
    return isReady
  }
}

export class TimeStampQuery extends GPUQuery {
  constructor() {
    super()
    this.ids = [gl.createQuery(), gl.createQuery()]
    this.elapsedMillis = 0
  }

  begin() {
    backend.timerEXT.queryCounterEXT(
      this.ids[0],
      backend.timerEXT.TIMESTAMP_EXT,
    )
  }

  end() {
    backend.timerEXT.queryCounterEXT(
      this.ids[1],
      backend.timerEXT.TIMESTAMP_EXT,
    )
  }

  ready() {
    const available0 = gl.getQueryParameter(
      this.ids[0],
      gl.QUERY_RESULT_AVAILABLE,
    )
    const available1 = gl.getQueryParameter(
      this.ids[1],
      gl.QUERY_RESULT_AVAILABLE,
    )

    const disjoint = gl.getParameter(backend.timerEXT.GPU_DISJOINT_EXT)
    const isReady = available0 && available1 && !disjoint
    if (isReady) {
      const start = gl.getQueryParameter(this.ids[0], gl.QUERY_RESULT)
      const end = gl.getQueryParameter(this.ids[1], gl.QUERY_RESULT)
      this.elapsedMillis = (end - start) / 1_000_000
    }

    return isReady
  }
}
