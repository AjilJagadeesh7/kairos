import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'

export function AiSection() {
  const aiUrl    = useAppStore((s) => s.aiUrl)
  const setAiUrl = useAppStore((s) => s.setAiUrl)

  const [localAiUrl, setLocalAiUrl] = useState(aiUrl)

  async function saveAiUrl() {
    setAiUrl(localAiUrl)
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  return (
    <div className="space-y-4">
      <SectionCard title="AI Server">
        <div className="space-y-3">
          <p className="text-xs text-[rgb(var(--text-2))]">
            URL of a local Ollama or compatible server used for embeddings and AI features.
          </p>
          <Field
            label="Server URL"
            placeholder="http://localhost:11434"
            type="url"
            value={localAiUrl}
            onChange={setLocalAiUrl}
          />
          <Button variant="primary" size="md" onClick={() => void saveAiUrl()}>Save</Button>
        </div>
      </SectionCard>
    </div>
  )
}
