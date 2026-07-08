export const CLIENT_NAME_COOKIE = 'client_name'

export function isValidClientName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100
}
