import { en } from './en'
import { th } from './th'
import { locale } from './locale'

export const messages = locale === 'en' ? en : th
export { play as playMessages } from './play-th'
