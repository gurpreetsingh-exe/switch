export default class Camera {
    constructor(location, target, fov, aspect, zNear, zFar) {
        this.location = location
        this.target = target
        this.fov = fov
        this.aspect = aspect
        this.zNear = zNear
        this.zFar = zFar

        this.projectionMatrix = mat4.create()
        this.viewMatrix = mat4.create()
        this.calcMatrix()
    }

    calcMatrix() {
        mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.zNear, this.zFar)
        mat4.lookAt(this.viewMatrix, this.location.asArray(), this.target.asArray(), [0, 0, 1])
    }

    resize(width, height) {
        this.aspect = width / height
        mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.zNear, this.zFar)
    }
}
