import { Author } from '~/graphql/generated/graphql'
import { capitalize } from '~/utils/capitalize'
import { cyrillicRegex, findFirstReadableCharIndex, notChar, notLatin, notRus } from './chars'
import { translit } from './translit'

/**
 * Checks if a string contains Cyrillic characters.
 * @param s - The string to check.
 * @returns `true` if the string contains Cyrillic characters, otherwise `false`.
 */
export const isCyrillic = (s: string): boolean => {
  return cyrillicRegex.test(s)
}

/**
 * Translates the author's name based on the provided language. For English (`lng === 'en'`), it transliterates
 * and capitalizes Cyrillic names, handling special cases for characters like 'ё' and 'ь'.
 * @param author - The author object containing the name to translate.
 * @param lng - The target language for translation ('en' or 'ru').
 * @returns The translated author name, or the original if no translation is needed.
 */
export const translateAuthor = (author: Author, lng: string) =>
  lng === 'en' && isCyrillic(author?.name || '')
    ? capitalize(
        translit((author?.name || '').replaceAll('ё', 'e').replaceAll('ь', '')).replaceAll('-', ' '),
        true
      )
    : author.name

/**
 * Reduces a list of authors into groups based on the first readable letter of their last name.
 * The grouping depends on the language ('ru' for Russian and 'en' for English).
 * Non-Cyrillic or non-Latin characters are grouped under `@`.
 * @param acc - The accumulator object for grouping authors by the first readable letter.
 * @param author - The author object containing the name.
 * @param lng - The language code ('en' or 'ru') used for transliteration and sorting.
 * @returns The accumulator object with authors grouped by the first readable letter of their last name.
 */
export const authorLetterReduce = (acc: { [x: string]: Author[] }, author: Author, lng: string) => {
  let letter = ''

  if (author?.name) {
    // Get the translated author name and clean it up
    const name = translateAuthor(author, lng || 'ru')?.trim() || ''
    const nameParts = name.split(' ')
    const lastName = nameParts.filter(Boolean).pop()?.replace(notChar, ' ').trim() || '' // Replace non-readable characters

    // Get the last part of the name
    if (lastName && lastName.length > 0) {
      const firstCharIndex = findFirstReadableCharIndex(lastName)

      // Make sure the index is valid before accessing the character
      if (firstCharIndex !== -1) {
        letter = lastName[firstCharIndex].toUpperCase()
      }
    }
  }

  // Handle non-readable letters based on the language
  if (notRus.test(letter) && lng === 'ru') letter = '@'
  if (notLatin.test(letter) && lng === 'en') letter = '@'

  // Initialize the letter group if it doesn't exist
  if (!acc[letter]) acc[letter] = []

  // Translate the author's name for the current language
  author.name = translateAuthor(author, lng)

  // Push the author into the corresponding letter group
  acc[letter].push(author)

  // Sort authors within each letter group alphabetically by name
  acc[letter].sort((a, b) => (a?.name || '').localeCompare(b?.name || ''))

  return acc
}
