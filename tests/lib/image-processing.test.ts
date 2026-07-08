import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { processImage } from '@/lib/image-processing'

describe('processImage', () => {
  it('produces a thumbnail and preview JPEG no wider than the target widths', async () => {
    const input = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer()

    const { thumbnail, preview } = await processImage(input)

    const thumbnailMeta = await sharp(thumbnail).metadata()
    const previewMeta = await sharp(preview).metadata()

    expect(thumbnailMeta.format).toBe('jpeg')
    expect(thumbnailMeta.width).toBeLessThanOrEqual(400)
    expect(previewMeta.format).toBe('jpeg')
    expect(previewMeta.width).toBeLessThanOrEqual(1600)
  })

  it('does not enlarge an image smaller than the target width', async () => {
    const input = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer()

    const { thumbnail } = await processImage(input)
    const thumbnailMeta = await sharp(thumbnail).metadata()

    expect(thumbnailMeta.width).toBe(200)
  })
})
