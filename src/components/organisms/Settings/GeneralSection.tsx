import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { ThemeSelect } from '../../molecules/ThemeSelect'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'

export function GeneralSection() {
  const theme    = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const aiUrl    = useAppStore((s) => s.aiUrl)
  const setAiUrl = useAppStore((s) => s.setAiUrl)

  const [localAiUrl, setLocalAiUrl] = useState(aiUrl)

  async function handleThemeChange(t: Parameters<typeof setTheme>[0]) {
    setTheme(t)
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  async function saveAiUrl() {
    setAiUrl(localAiUrl)
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[rgb(var(--text))]">Theme</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Choose your preferred colour scheme</p>
          </div>
          <ThemeSelect value={theme} onChange={(t) => void handleThemeChange(t)} />
        </div>
      </SectionCard>

      <SectionCard title="AI Server">
        <div className="space-y-3">
          <p className="text-xs text-[rgb(var(--text-2))]">
            URL of a local Ollama or compatible server used for embeddings and AI features.
          </p>
          <Field label="Server URL" placeholder="http://localhost:11434" type="url" value={localAiUrl} onChange={setLocalAiUrl} />
          <Button variant="primary" size="sm" onClick={() => void saveAiUrl()}>Save</Button>
        </div>
      </SectionCard>
    </div>
  )
}
