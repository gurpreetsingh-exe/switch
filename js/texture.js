import { backend, gl } from "./context.js"
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

let irradianceShader
let prefilterShader
export const loadCubeMapShader = async () => {
  const vr = await fetch("shaders/fs_quad.glsl")
  const fr2 = await fetch("shaders/cubemap_convolution.glsl")
  const fr3 = await fetch("shaders/prefilter.glsl")
  const vertex = await vr.text()

  irradianceShader = new Shader({
    vertex,
    fragment: await fr2.text(),
  })

  prefilterShader = new Shader({
    vertex,
    fragment: await fr3.text(),
  })
}

/**
 * @param {WebGL2RenderingContext} gl
 */
export const loadEnvTexture = async (gl, url, width, height) => {
  const r = await fetch(url)
  const blob = await r.blob()
  const result = await blob.arrayBuffer()
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)

  const loader = new RGBELoader()
  let currentHDR = loader.parse(result)
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

  let hdri_id = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, hdri_id)
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
  const hdri = new Texture(
    Texture2D,
    currentHDR.width,
    currentHDR.height,
    hdri_id,
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
  gl.viewport(0, 0, width, height)

  const vr = await fetch("shaders/fs_quad.glsl")
  const fr = await fetch("shaders/panorama_to_cubemap.glsl")
  const shader = new Shader({
    vertex: await vr.text(),
    fragment: await fr.text(),
  })

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

      shader.uniformSampler("uPanorama", hdri)
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

export const Texture2D = Symbol()
export const TextureCubeMap = Symbol()

const gl_texture_target = x => {
  if (x === Texture2D) {
    return gl.TEXTURE_2D
  } else if (x === TextureCubeMap) {
    return gl.TEXTURE_CUBE_MAP
  } else {
    throw new Error("unexpected texture type", x)
  }
}

export class Texture {
  constructor(kind, width, height, id) {
    this.kind = kind
    this.width = width
    this.height = height
    this.target = gl_texture_target(this.kind)
    this.id = id
  }

  static async create(info) {
    let id
    if (info.kind === TextureCubeMap) {
      id = await loadEnvTexture(gl, info.url, info.width, info.height)
    } else if (info.kind === Texture2D) {
      id = await loadTexture(gl, info.url)
    }
    const target = gl_texture_target(info.kind)
    gl.bindTexture(target, null)
    return new Texture(info.kind, info.width, info.height, id)
  }

  bind() {
    gl.bindTexture(this.target, this.id)
  }

  unbind() {
    gl.bindTexture(this.target, null)
  }
}

export const generateIrradiance = (hdri, size) => {
  const id = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  for (let i = 0; i < 6; ++i) {
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      0,
      gl.RGBA,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
  }

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    id,
    0,
  )
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("framebuffer status not complete")
  }

  gl.viewport(0, 0, size, size)
  irradianceShader.with(() => {
    for (let i = 0; i < 6; ++i) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        id,
        0,
      )

      irradianceShader.uniformSampler("uHdri", hdri)
      irradianceShader.uniformInt("uCurrentFace", i)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  })

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
  return new Texture(TextureCubeMap, size, size, id)
}

export const generatePrefilter = (hdri, size) => {
  const id = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
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
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
  }
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  const maxMipLevel = Math.floor(backend.maxMipLevel * 0.5)
  for (let mip = 0; mip < maxMipLevel; ++mip) {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      id,
      0,
    )
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("framebuffer status not complete")
    }

    const m = 0.5 ** mip
    const mipSize = size * m
    gl.viewport(0, 0, mipSize, mipSize)

    prefilterShader.with(() => {
      prefilterShader.uniformFloat("uResolution", size)
      prefilterShader.uniformFloat("uRoughness", mip / (maxMipLevel - 1))
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, id)
      for (let i = 0; i < 6; ++i) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
          id,
          mip,
        )

        prefilterShader.uniformSampler("uHdri", hdri)
        prefilterShader.uniformInt("uCurrentFace", i)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    })
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
  return new Texture(TextureCubeMap, size, size, id)
}
