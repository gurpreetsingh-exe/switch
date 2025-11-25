export const loadImage = (path) =>
    new Promise(resolve => {
        const image = new Image()
        image.addEventListener('load', () => {
            resolve(image)
        })
        image.src = path
        return image
    })

export const loadModel = (url) => fetch(url).then(r => r.json())

export class RGBELoader {
    parse(buffer) {
        const uint8Array = new Uint8Array(buffer)
        let pos = 0
        let header = ''
        let char
        while (pos < uint8Array.length) {
            char = String.fromCharCode(uint8Array[pos])
            header += char
            pos++
            if (header.endsWith('\n\n')) { break }
        }

        if (!header.startsWith('#?RADIANCE') && !header.startsWith('#?RGBE')) {
            throw new Error('Invalid HDR file: Missing magic number')
        }

        let resolutionLine = ''
        while (pos < uint8Array.length) {
            char = String.fromCharCode(uint8Array[pos])
            resolutionLine += char
            pos++
            if (char === '\n') {
                break
            }
        }

        const resMatch = resolutionLine.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/)
        if (!resMatch) throw new Error('Could not parse HDR resolution')

        const height = parseInt(resMatch[1])
        const width = parseInt(resMatch[2])
        const data = new Uint8Array(width * height * 4)

        let ptr = 0

        for (let y = 0; y < height; y++) {
            const b1 = uint8Array[pos++]
            const b2 = uint8Array[pos++]
            const len = uint8Array[pos++] * 256 + uint8Array[pos++]

            if (b1 !== 2 || b2 !== 2 || (len & 0x8000)) {
                throw new Error('Format not supported: Old RLE or corrupted data')
            }

            if (len !== width) {
                throw new Error('Invalid scanline width')
            }

            const scanlineBuffer = new Uint8Array(4 * width)
            let ptrScan = 0

            for (let i = 0; i < 4; i++) {
                let ptrEnd = (i + 1) * width

                while (ptrScan < ptrEnd) {
                    const buf1 = uint8Array[pos++]
                    const buf2 = uint8Array[pos++]

                    if (buf1 > 128) {
                        let count = buf1 - 128
                        if ((count === 0) || (count > ptrEnd - ptrScan)) {
                            throw new Error('Bad RLE data')
                        }
                        while (count-- > 0) {
                            scanlineBuffer[ptrScan++] = buf2
                        }
                    } else {
                        let count = buf1
                        if ((count === 0) || (count > ptrEnd - ptrScan)) {
                            throw new Error('Bad RLE data')
                        }
                        scanlineBuffer[ptrScan++] = buf2
                        count--
                        while (count-- > 0) {
                            scanlineBuffer[ptrScan++] = uint8Array[pos++]
                        }
                    }
                }
            }

            for (let x = 0; x < width; x++) {
                const r = scanlineBuffer[x]
                const g = scanlineBuffer[x + width]
                const b = scanlineBuffer[x + 2 * width]
                const e = scanlineBuffer[x + 3 * width]

                if (e === 0) {
                    data[ptr++] = 0
                    data[ptr++] = 0
                    data[ptr++] = 0
                    data[ptr++] = 0
                } else {
                    const f = Math.pow(2, e - 136)
                    const fixRange = (x) => Math.min(255, Math.max(0, x * 255));
                    data[ptr++] = fixRange(r * f);
                    data[ptr++] = fixRange(g * f);
                    data[ptr++] = fixRange(b * f);
                    data[ptr++] = 255;
                }
            }
        }

        return { width, height, data }
    }
}
