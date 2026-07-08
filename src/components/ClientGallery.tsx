'use client'

import { useState } from 'react'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
}

export function ClientGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button type="button" onClick={() => setOpenIndex(index)}>
              <img src={photo.thumbnailUrl} alt="Photo thumbnail" width={200} />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <div role="dialog" aria-label="Photo preview">
          <button type="button" onClick={() => setOpenIndex(null)}>
            Close
          </button>
          {openIndex > 0 && (
            <button type="button" onClick={() => setOpenIndex(openIndex - 1)}>
              Previous
            </button>
          )}
          <img src={photos[openIndex].previewUrl} alt="Photo preview" />
          {openIndex < photos.length - 1 && (
            <button type="button" onClick={() => setOpenIndex(openIndex + 1)}>
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}
