import { describe, it, expect } from 'vitest'
import { stripExtension } from '@/lib/photo-name'

describe('stripExtension', () => {
  it('strips extension from filenames', () => {
    expect(stripExtension('IMG_0001.jpg')).toBe('IMG_0001')
    expect(stripExtension('wedding.photo.PNG')).toBe('wedding.photo')
  })

  it('handles filenames without extension or starting with dot', () => {
    expect(stripExtension('IMG_0001')).toBe('IMG_0001')
    expect(stripExtension('.gitignore')).toBe('.gitignore')
  })

  it('returns Untitled photo when null, undefined, or empty string', () => {
    expect(stripExtension(undefined)).toBe('Untitled photo')
    expect(stripExtension(null)).toBe('Untitled photo')
    expect(stripExtension('')).toBe('Untitled photo')
    expect(stripExtension('   ')).toBe('Untitled photo')
  })
})
