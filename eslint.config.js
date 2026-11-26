import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/', 'public/stockfish/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/pwa/sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': hooks },
    rules: hooks.configs.recommended.rules,
  },
)
