const DEBUG_WINDOW_WIDTH = 200
const DEBUG_WINDOW_HEIGHT = 120
const BORDER = 0

export default class State {
  constructor() {
    this.activeAction = 0
    this.actionList = []
    this.actions = new Map()
    this.timer = null

    this.isOpen = true
    this.debugWindow = {
      x: window.innerWidth - DEBUG_WINDOW_WIDTH,
      y: window.innerHeight - DEBUG_WINDOW_HEIGHT,
    }
    this.debug = document.getElementById("debug")
    this.debug.classList.add("debug")
    this.debug.style.position = "absolute"
    this.debug.style.zIndex = 140
    this.debug.style.backgroundColor = "rgba(0, 0, 0, 0.1)"
    this.debug.style.color = "#fff"
    this.debug.style.padding = "10px"
    this.debug.style.width = `${DEBUG_WINDOW_WIDTH}px`
    this.debug.style.height = `${DEBUG_WINDOW_HEIGHT}px`
    this.debug.style.fontFamily = "monospace"
    this.debug.style.fontSize = "6px"

    window.addEventListener("keydown", e => {
      if (e.code == "KeyD") {
        this.isOpen = !this.isOpen
      }

      if (this.isOpen) {
        this.debug.style.display = "block"
        this.resizeInner(window)
      } else {
        this.debug.style.display = "none"
      }
    })

    this.frameCount = 0
    window.debugTickDelay = 15
  }

  resizeInner(window) {
    this.debugWindow.x = 0
    this.debugWindow.y = window.innerHeight - DEBUG_WINDOW_HEIGHT
    this.debug.style.left = `${this.debugWindow.x - BORDER * 2}px`
    this.debug.style.top = `${this.debugWindow.y - BORDER * 2}px`
  }

  addAction(type, action) {
    this.actionList.push(type)
    this.actions.set(type, action)
  }

  getActiveAction = () => this.actions.get(this.actionList[this.activeAction])

  tick(deltaTime) {
    const action = this.getActiveAction()
    if (!action.isPlaying() && this.activeAction < this.actionList.length - 1) {
      this.activeAction += 1
    }
    action.update()
    this.debugTick(deltaTime)
  }

  debugTick(_deltaTime) {
    this.frameCount++
    this.timer.gpuTimer.getAllTimings()

    if (!this.isOpen) {
      return
    }
    let finalText = ""
    const debugTextAdd = text =>
      (finalText += `<div style="white-space: pre;">${text}</div>`)
    if (this.frameCount % window.debugTickDelay === 0) {
      let i = 0
      debugTextAdd("                      Timings                      ")
      debugTextAdd(" +=================================================+")
      debugTextAdd(" | IDX |             NAME |  GPU TIME |  CPU TIME  |")
      debugTextAdd(" |-------------------------------------------------|")
      let names = new Set(this.timer.gpuTimer.timings.keys())
      names = names.union(new Set(this.timer.cpuTimer.timings.keys()))
      for (const name of names) {
        const n = `${++i}`.padStart(2, "0")
        const nm = `${name.padStart(16)}`
        let gpuTime = "----".padStart(6)
        if (this.timer.gpuTimer.timings.has(name)) {
          const { queryObj } = this.timer.gpuTimer.timings.get(name)
          gpuTime = `${queryObj.elapsedMillis.toFixed(2)}`.padStart(6)
        }

        let cpuTime = "----".padStart(6)
        if (this.timer.cpuTimer.timings.has(name)) {
          const cpuElapsedMillis = this.timer.cpuTimer.timings.get(name)
          cpuTime = `${cpuElapsedMillis.toFixed(2)}`.padStart(6)
        }

        debugTextAdd(` |  ${n} | ${nm} | ${gpuTime} ms | ${cpuTime} ms  |`)
      }
      debugTextAdd(" +=================================================+")
      this.debug.innerHTML = finalText
    }
  }
}
