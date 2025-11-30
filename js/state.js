export default class State {
  constructor() {
    this.activeAction = 0
    this.actionList = []
    this.actions = new Map()
  }

  addAction(type, action) {
    this.actionList.push(type)
    this.actions.set(type, action)
  }

  getActiveAction = () => this.actions.get(this.actionList[this.activeAction])

  tick() {
    const action = this.getActiveAction()
    if (!action.isPlaying() && this.activeAction < this.actionList.length - 1) {
      this.activeAction += 1
    }
    action.update()
  }
}
