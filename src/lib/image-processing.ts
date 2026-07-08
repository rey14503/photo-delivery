import sharp from 'sharp'

const THUMBNAIL_WIDTH = 400
const PREVIEW_WIDTH = 1600
const JPEG_QUALITY = 80

export interface ProcessedImage {
  thumbnail: Buffer
  preview: Buffer
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const [thumbnail, preview] = await Promise.all([
    sharp(buffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer(),
    sharp(buffer)
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer(),
  ])
  return { thumbnail, preview }
}
