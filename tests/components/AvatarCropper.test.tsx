import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AvatarCropper } from '@/components/AvatarCropper'

// Mock getCroppedImg since canvas toBlob isn't fully supported in JSDOM
vi.mock('@/lib/cropImage', () => ({
  getCroppedImg: vi.fn().mockResolvedValue(new Blob(['test-image'], { type: 'image/jpeg' })),
}))

describe('AvatarCropper', () => {
  const onClose = vi.fn()
  const onCropComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false or imageSrc is null', () => {
    const { rerender } = render(
      <AvatarCropper imageSrc={null} isOpen={true} onClose={onClose} onCropComplete={onCropComplete} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(
      <AvatarCropper imageSrc="blob:http://localhost/image.png" isOpen={false} onClose={onClose} onCropComplete={onCropComplete} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders cropper dialog when isOpen and imageSrc are provided', () => {
    render(
      <AvatarCropper
        imageSrc="blob:http://localhost/image.png"
        isOpen={true}
        onClose={onClose}
        onCropComplete={onCropComplete}
      />
    )
    expect(screen.getByRole('dialog', { name: 'Adjust & Crop Avatar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apply & Upload/i })).toBeInTheDocument()
  })

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <AvatarCropper
        imageSrc="blob:http://localhost/image.png"
        isOpen={true}
        onClose={onClose}
        onCropComplete={onCropComplete}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
