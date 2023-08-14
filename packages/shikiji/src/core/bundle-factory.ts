import type { BundledHighlighterOptions, CodeToHtmlThemesOptions, CodeToHtmlOptions, CodeToThemedTokensOptions, HighlighterCoreOptions, HighlighterGeneric, LanguageInput, MaybeArray, PlainTextLanguage, RequireKeys, ThemeInput } from '../types'
import { isPlaintext, toArray } from './utils'
import { getHighlighterCore } from './core'

export type GetHighlighterFactory<L extends string, T extends string> = (options?: BundledHighlighterOptions<L, T>) => Promise<HighlighterGeneric<L, T>>

/**
 * Create a `getHighlighter` function with bundled themes and languages.
 *
 * @param bundledLanguages
 * @param bundledThemes
 * @param ladWasm
 */
export function createdBundledHighlighter<BundledLangs extends string, BundledThemes extends string>(
  bundledLanguages: Record<BundledLangs, LanguageInput>,
  bundledThemes: Record<BundledThemes, ThemeInput>,
  ladWasm: HighlighterCoreOptions['loadWasm'],
): GetHighlighterFactory<BundledLangs, BundledThemes> {
  async function getHighlighter(options: BundledHighlighterOptions<BundledLangs, BundledThemes> = {}): Promise<HighlighterGeneric<BundledLangs, BundledThemes>> {
    function resolveLang(lang: LanguageInput | BundledLangs | PlainTextLanguage): LanguageInput {
      if (typeof lang === 'string') {
        if (isPlaintext(lang))
          return []
        const bundle = bundledLanguages[lang as BundledLangs]
        if (!bundle)
          throw new Error(`[shikiji] Language \`${lang}\` is not built-in.`)
        return bundle
      }
      return lang as LanguageInput
    }

    function resolveTheme(theme: ThemeInput | BundledThemes): ThemeInput {
      if (typeof theme === 'string') {
        const bundle = bundledThemes[theme]
        if (!bundle)
          throw new Error(`[shikiji] Theme \`${theme}\` is not built-in.`)
        return bundle
      }
      return theme
    }

    const _themes = (options.themes ?? []).map(i => resolveTheme(i)) as ThemeInput[]

    const langs = (options.langs ?? [] as BundledLangs[])
      .map(i => resolveLang(i))

    const core = await getHighlighterCore({
      ...options,
      themes: _themes,
      langs,
      loadWasm: ladWasm,
    })

    return {
      ...core,
      codeToHtml(code, options = {}) {
        return core.codeToHtml(code, options)
      },
      loadLanguage(...langs) {
        return core.loadLanguage(...langs.map(resolveLang))
      },
      loadTheme(...themes) {
        return core.loadTheme(...themes.map(resolveTheme))
      },
    }
  }

  return getHighlighter
}

export function createSingletonShorthands<L extends string, T extends string >(getHighlighter: GetHighlighterFactory<L, T>) {
  let _shiki: ReturnType<typeof getHighlighter>

  async function getShikiWithThemeLang(options: { theme: MaybeArray<T>; lang: MaybeArray<L | PlainTextLanguage> }) {
    if (!_shiki) {
      _shiki = getHighlighter({
        themes: toArray(options.theme),
        langs: toArray(options.lang),
      })
      return _shiki
    }
    else {
      const s = await _shiki
      await Promise.all([
        s.loadTheme(...toArray(options.theme)),
        s.loadLanguage(...toArray(options.lang)),
      ])
      return s
    }
  }

  /**
   * Shorthand for `codeToHtml` with auto-loaded theme and language.
   * A singleton highlighter it maintained internally.
   *
   * Differences from `shiki.codeToHtml()`, this function is async.
   */
  async function codeToHtml(code: string, options: RequireKeys<CodeToHtmlOptions<L, T>, 'theme' | 'lang'>) {
    const shiki = await getShikiWithThemeLang(options)
    return shiki.codeToHtml(code, options)
  }

  /**
   * Shorthand for `codeToThemedTokens` with auto-loaded theme and language.
   * A singleton highlighter it maintained internally.
   *
   * Differences from `shiki.codeToThemedTokens()`, this function is async.
   */
  async function codeToThemedTokens(code: string, options: RequireKeys<CodeToThemedTokensOptions<L, T>, 'theme' | 'lang'>) {
    const shiki = await getShikiWithThemeLang(options)
    return shiki.codeToThemedTokens(code, options)
  }

  /**
   * Shorthand for `codeToHtmlThemes` with auto-loaded theme and language.
   * A singleton highlighter it maintained internally.
   *
   * Differences from `shiki.codeToHtmlThemes()`, this function is async.
   */
  async function codeToHtmlThemes(code: string, options: RequireKeys<CodeToHtmlThemesOptions<L, T>, 'themes' | 'lang'>) {
    const shiki = await getShikiWithThemeLang({
      lang: options.lang,
      theme: Object.values(options.themes).filter(Boolean) as T[],
    })
    return shiki.codeToHtmlThemes(code, options)
  }

  return {
    codeToHtml,
    codeToHtmlThemes,
    codeToThemedTokens,
  }
}