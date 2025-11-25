import { loadImage, RGBELoader } from "./loaders.js"
import { initShaderProgram } from "./shader.js"

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

const s_fullscreen = `#version 300 es
precision highp float;
out vec2 v_uv;

void main(void) {
  float x = float((gl_VertexID & 1) << 2);
  float y = float((gl_VertexID & 2) << 1);
  v_uv = .5f * vec2(x, y);
  gl_Position = vec4(x - 1.f, y - 1.f, 0.f, 1.f);
}
`

const s_panorama_to_cubemap = `#version 300 es
precision highp float;

#define MATH_PI 3.1415926535897932384626433832795
#define MATH_INV_PI (1.0 / MATH_PI)

in vec2 v_uv;
out vec4 FragColor;

uniform int uCurrentFace;
uniform sampler2D uPanorama;

vec3 uv_to_xyz(int face, vec2 uv) {
  if (face == 0) {
    return vec3(1.f, uv.y, -uv.x);
  } else if (face == 1) {
    return vec3(-1.f, uv.y, uv.x);
  } else if (face == 2) {
    return vec3(uv.x, -1.f, uv.y);
  } else if (face == 3) {
    return vec3(uv.x, 1.f, -uv.y);
  } else if (face == 4) {
    return vec3(uv.x, uv.y, 1.f);
  } else {
    return vec3(-uv.x, uv.y, -1.f);
  }
}

vec2 dir_to_uv(vec3 dir) {
  return vec2(0.5f + 0.5f * atan(dir.y, dir.x) / MATH_PI,
              acos(dir.z) / MATH_PI);
}

vec3 panorama_to_cubemap(int face, vec2 coords) {
  vec2 coords_new = coords * 2.0 - 1.0;
  vec3 scan = uv_to_xyz(face, coords_new);
  vec3 direction = normalize(scan);
  vec2 src = dir_to_uv(direction);
  return texture(uPanorama, src).rgb;
}

void main(void) {
  FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  FragColor.rgb = panorama_to_cubemap(uCurrentFace, v_uv);
}
`

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
    console.log(`${currentHDR.width}, ${currentHDR.height}`);
    const width = 1000
    const height = 1000
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    for (let i = 0; i < 6; ++i) {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0,
            gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            null)
    }

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

    const shader = initShaderProgram(gl, s_fullscreen, s_panorama_to_cubemap)
    const panorama = gl.getUniformLocation(shader, "uPanorama")
    const currentFace = gl.getUniformLocation(shader, "uCurrentFace")

    let hdri = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, hdri)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, currentHDR.width, currentHDR.height, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, currentHDR.data)

    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X, texture, 0)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("framebuffer status not complete")
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    gl.viewport(0, 0, 1000, 1000)
    gl.useProgram(shader)
    for (let i = 0; i < 6; ++i) {
        const side = i
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + side, texture, 0)

        gl.bindTexture(gl.TEXTURE_2D, hdri)
        gl.uniform1i(panorama, 0)
        gl.uniform1i(currentFace, i)

        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.deleteFramebuffer(fbo)
    return texture
}
