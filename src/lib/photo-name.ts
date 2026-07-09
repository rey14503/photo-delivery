export function stripExtension(filename?: string | null): string {
  if (!filename || !filename.trim()) {
    return 'Untitled photo'
  }
  const trimmed = filename.trim()
  const lastDotIndex = trimmed.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return trimmed
  }
  return trimmed.substring(0, lastDotIndex)
}
