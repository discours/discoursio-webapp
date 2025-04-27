import { InputMaybe, MediaItemInput } from '~/graphql/schema/core.gen'

type ParsedValueType =
  | string
  | string[]
  | number
  | number[]
  | InputMaybe<MediaItemInput>[]
  | null
  | undefined

// Helper function to safely parse JSON fields
export const tryParseJson = (value?: ParsedValueType, fieldName?: string) => {
  if (!value) return value
  if (!fieldName) return value
  if (typeof value !== 'string') return value // Already parsed or not a string
  // Basic check for JSON-like strings
  if (
    (value.toString().startsWith('{') && value.toString().endsWith('}')) ||
    (value.toString().startsWith('[') && value.toString().endsWith(']'))
  ) {
    try {
      return JSON.parse(value.toString())
    } catch (e) {
      console.warn(`[drafts] Failed to parse JSON for field ${fieldName}:`, e, 'Raw value:', value)
      return value // Return raw string if parsing fails
    }
  }
  return value // Not JSON-like, return as is
}
