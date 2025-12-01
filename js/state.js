const DEBUG_WINDOW_WIDTH = 300
const DEBUG_WINDOW_HEIGHT = 300
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
    this.debug.style.position = "absolute"
    this.debug.style.zIndex = 140
    this.debug.style.backgroundColor = "rgba(0, 0, 0, 0.1)"
    this.debug.style.color = "#fff"
    this.debug.style.padding = "10px"
    this.debug.style.width = `${DEBUG_WINDOW_WIDTH}px`
    this.debug.style.height = `${DEBUG_WINDOW_HEIGHT}px`
    this.debug.style.fontFamily = "monospace"

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
    this.debugWindow.x = window.innerWidth - DEBUG_WINDOW_WIDTH
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

  debugTick(deltaTime) {
    this.frameCount++
    this.timer.getAllTimings()

    if (!this.isOpen) {
      return
    }
    let finalText = ""
    const debugTextAdd = text => (finalText += `<div>${text}</div>`)
    if (this.frameCount % window.debugTickDelay === 0) {
      debugTextAdd(`Delta Time: ${deltaTime.toFixed(3)} ms`)
      let i = 0
      for (const [name, query] of this.timer.timings) {
        const n = `${++i}`.padStart(2, "0")
        const time = `${query.elapsedMillis.toFixed(3)}`.padStart(8)
        const nm = `${name.padStart(16)}`
        debugTextAdd(`| #${n} ${nm}: ${time} ms`)
      }
      this.debug.innerHTML = finalText
    }
  }
}
