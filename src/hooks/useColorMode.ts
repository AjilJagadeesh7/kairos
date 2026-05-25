import { useEffect, useState } from 'react'

function getBgLuminance() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  const parts = raw.split(' ').map(Number)
  return parts.length === 3 ? (parts[0] + parts[1] + parts[2]) / 3 : 0
}

export function useColorMode(): 'dark' | 'light' {
  const [isDark, setIsDark] = useState(() => getBgLuminance() < 128)
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(getBgLuminance() < 128))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    return () => obs.disconnect()
  }, [])
  return isDark ? 'dark' : 'light'
}
