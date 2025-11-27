export default class State {
  constructor() {
    this.activeScene = 0
    this.sceneList = []
    this.scenes = new Map()
  }

  addScene(type, scene) {
    this.sceneList.push(type)
    this.scenes.set(type, scene)
  }

  getActiveScene = () => this.scenes.get(this.sceneList[this.activeScene])

  tick() {
    const scene = this.getActiveScene()
    if (!scene.isPlaying() && this.activeScene < this.sceneList.length - 1) {
      this.activeScene += 1
    }
    scene.update()
  }
}
