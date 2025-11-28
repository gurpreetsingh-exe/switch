import { loadImage, RGBELoader } from "./loaders.js"
import { Shader } from "./shader.js"

/**
 * @param {WebGL2RenderingContext} gl
 */
export const loadTexture = async (gl, url) => {
  const image = await loadImage(url)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.generateMipmap(gl.TEXTURE_2D)
  return texture
}

/**
 * @param {WebGL2RenderingContext} gl
 */
export const loadEnvTexture = async (gl, url) => {
  const r = await fetch(url)
  const blob = await r.blob()
  const result = await blob.arrayBuffer()
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)

  const loader = new RGBELoader()
  let currentHDR = loader.parse(result)
  const width = 1000
  const height = 1000
  gl.texParameteri(
    gl.TEXTURE_CUBE_MAP,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  )
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  for (let i = 0; i < 6; ++i) {
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
  }

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

  const vr = await fetch("shaders/fs_quad.glsl")
  const fr = await fetch("shaders/panorama_to_cubemap.glsl")

  const shader = new Shader({
    vertex: await vr.text(),
    fragment: await fr.text(),
  })

  let hdri = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, hdri)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    currentHDR.width,
    currentHDR.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    currentHDR.data,
  )

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    texture,
    0,
  )
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("framebuffer status not complete")
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.viewport(0, 0, 1000, 1000)
  shader.with(() => {
    for (let i = 0; i < 6; ++i) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        texture,
        0,
      )

      shader.uniformSampler("uPanorama", gl.TEXTURE_2D, hdri)
      shader.uniformInt("uCurrentFace", i)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  })

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
  gl.deleteFramebuffer(fbo)
  return texture
}
