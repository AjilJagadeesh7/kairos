import { SectionCard } from '../../molecules/SectionCard'

export function AboutSection() {
  return (
    <div className="space-y-4">
      <SectionCard title="About MindVault">
        <div className="space-y-3 text-sm text-[rgb(var(--text-2))]">
          <p>MindVault is a privacy-first note-taking app with semantic search, wikilinks, and end-to-end encryption.</p>
          <p>Notes are stored locally first. Sync is optional and always encrypted before leaving your device.</p>
          <div className="rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2 font-mono text-xs text-[rgb(var(--text-3))]">
            v0.0.0 · MIT License
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
