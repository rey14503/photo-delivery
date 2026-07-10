// tests/components/SuperpowerIcons.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  LockIcon,
  UnlockIcon,
  ClipboardListIcon,
  TxtFileIcon,
  ZoomInIcon,
  ZoomOutIcon,
  InfoOutlineIcon,
  ZipBoxIcon,
} from '@/components/PhotoIcons'

describe('SuperpowerIcons', () => {
  it('renders all 8 superpower icons cleanly with viewBox 0 0 24 24', () => {
    const { container } = render(
      <div>
        <LockIcon />
        <UnlockIcon />
        <ClipboardListIcon />
        <TxtFileIcon />
        <ZoomInIcon />
        <ZoomOutIcon />
        <InfoOutlineIcon />
        <ZipBoxIcon />
      </div>
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(8)
    svgs.forEach((svg) => {
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg.getAttribute('stroke-linecap')).toBe('round')
    })
  })
})
