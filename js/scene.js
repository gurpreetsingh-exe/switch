class Scene {
    static type = undefined

    update() {
        throw new Error("cannot call `update()` on abstract class `Scene`")
    }

    isPlaying() {
        throw new Error("cannot call `isPlaying()` on abstract class `Scene`")
    }
}

export class IntroScene extends Scene {
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

export class OrbitScene extends Scene {
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
