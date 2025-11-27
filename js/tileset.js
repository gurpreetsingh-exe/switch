export default class TileSet {
  #image
  #map

  constructor(image, width, height) {
    this.#image = image
    this.width = width
    this.height = height
    this.#map = new Map()
  }

  make(name, x, y) {
    const image = document.createElement("canvas")
    image.width = this.width
    image.height = this.height
    image
      .getContext("2d")
      .drawImage(
        this.#image,
        x * this.width,
        y * this.height,
        this.width,
        this.height,
        0,
        0,
        this.width,
        this.height,
      )

    this.#map.set(name, image)
  }

  draw(name, cx, x, y) {
    cx.drawImage(this.#map.get(name), x, y)
  }
}
