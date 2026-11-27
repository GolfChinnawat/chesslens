export type Locale = 'th' | 'en'

const storageKey = 'chesslens.locale'

function readLocale(): Locale {
  try {
    const requested = new URLSearchParams(window.location.search).get('lang')
    if (requested === 'en' || requested === 'th') return requested
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'th'
  } catch {
    return 'th'
  }
}

export const locale = readLocale()

export function translate(
  thai: string,
  english: string,
  ...values: (string | number)[]
) {
  const message = locale === 'en' ? english : thai
  return values.length
    ? message.replace(/\{(\d+)\}/g, (token, index: string) =>
        String(values[Number(index)] ?? token),
      )
    : message
}

export function changeLocale(next: Locale) {
  if (next === locale) return
  const url = new URL(window.location.href)
  try {
    localStorage.setItem(storageKey, next)
    url.searchParams.delete('lang')
  } catch {
    url.searchParams.set('lang', next)
  }
  window.location.replace(url.href)
}
