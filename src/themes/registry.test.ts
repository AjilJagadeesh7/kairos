import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, LIGHT_THEMES, DARK_THEMES, isDarkTheme } from './registry'
// index.html is plain text to Vite, so `?raw` returns it verbatim. (`index.css?raw`
// does NOT work — the CSS pipeline returns an empty string under vitest — so the
// registry↔stylesheet link is verified by hand, not here.)
import html from '../../index.html?raw'

describe('theme registry', () => {
  it('has unique ids', () => {
    const ids = THEME_REGISTRY.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('splits cleanly into light and dark', () => {
    expect(LIGHT_THEMES.length + DARK_THEMES.length).toBe(THEME_REGISTRY.length)
    expect(LIGHT_THEMES.every(t => !t.isDark)).toBe(true)
    expect(DARK_THEMES.every(t => t.isDark)).toBe(true)
  })

  it('marks the paired variants correctly', () => {
    expect(isDarkTheme('bubblegum-light')).toBe(false)
    expect(isDarkTheme('bubblegum-dark')).toBe(true)
    expect(isDarkTheme('arcade-light')).toBe(false)
    expect(isDarkTheme('arcade-dark')).toBe(true)
    expect(isDarkTheme('light')).toBe(false)
    expect(isDarkTheme('dracula')).toBe(true)
  })

  it('pairs every themed palette with both a light and a dark variant', () => {
    // Ids ending -light/-dark must come in pairs, or the picker shows an orphan.
    const paired = THEME_REGISTRY.filter(t => /-(light|dark)$/.test(t.id))
    const families = new Set(paired.map(t => t.id.replace(/-(light|dark)$/, '')))
    for (const family of families) {
      expect(paired.some(t => t.id === `${family}-light`), `${family} has no light variant`).toBe(true)
      expect(paired.some(t => t.id === `${family}-dark`), `${family} has no dark variant`).toBe(true)
    }
  })

  it('keeps the pre-hydration script in sync with the registry', () => {
    // Every theme needs a background colour, or the first paint flashes white.
    for (const theme of THEME_REGISTRY) {
      expect(html, `"${theme.id}" missing from the index.html background map`)
        .toContain(`'${theme.id}'`)
    }
    // Dark ids must also be listed in the pre-hydration darkThemes array, or the
    // wrong colour scheme is applied until React hydrates.
    const start = html.indexOf('var darkThemes')
    expect(start, 'index.html has no darkThemes array').toBeGreaterThan(-1)
    const darkArray = html.slice(start, html.indexOf('];', start))
    for (const theme of DARK_THEMES) {
      expect(darkArray, `"${theme.id}" missing from index.html darkThemes`).toContain(theme.id)
    }
    for (const theme of LIGHT_THEMES) {
      expect(darkArray, `"${theme.id}" wrongly listed in index.html darkThemes`).not.toContain(theme.id)
    }
  })
})
