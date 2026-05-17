import { BrainCircuit, FolderSync, Network, StickyNote, SquareKanban, ShieldCheck, ExternalLink } from 'lucide-react'
import { SectionCard } from '../../molecules/SectionCard'

const FEATURES = [
  {
    icon: StickyNote,
    title: 'Notes',
    desc: 'Markdown editor with live preview, wikilinks ([[note title]]), inline tags (#tag), full-text and semantic AI search, backlinks panel, and PDF export.',
  },
  {
    icon: SquareKanban,
    title: 'Kanban',
    desc: 'Multi-board task management with drag-and-drop columns, subtasks, checkpoints, priorities, due dates, labels, and linked notes. Tasks can be linked to notes and to each other.',
  },
  {
    icon: Network,
    title: 'Graph',
    desc: 'Force-directed knowledge graph showing note–note wikilinks, tag clusters, and kanban task nodes. Neighbourhood focus mode, right-click to create links directly from the graph.',
  },
  {
    icon: FolderSync,
    title: 'Sync',
    desc: 'Optional, always opt-in. Supports S3-compatible storage and WebDAV. All notes are encrypted on-device before upload — the server never sees plaintext.',
  },
  {
    icon: BrainCircuit,
    title: 'AI (local)',
    desc: 'Semantic search and embeddings via a local Ollama endpoint. No data ever leaves your device to a third-party AI service.',
  },
]

const PRIVACY_POINTS = [
  'No accounts, no sign-up, no email required.',
  'All notes are stored locally on your device only.',
  'No telemetry, analytics, or usage tracking of any kind.',
  'Sync is completely optional. When enabled, notes are encrypted with your key before leaving your device.',
  'The sync server (S3/WebDAV) stores only ciphertext — it cannot read your notes.',
  'AI features use a local model endpoint you configure; no data is sent to Anthropic, OpenAI, or any cloud AI service.',
  'The app works fully offline; no network connection is ever required.',
]

export function AboutSection() {
  return (
    <div className="space-y-5">
      {/* About */}
      <SectionCard title="About MindVault">
        <div className="space-y-3 text-sm text-[rgb(var(--text-2))]">
          <p>
            MindVault is a <strong className="text-[rgb(var(--text))]">privacy-first</strong>, local-first knowledge base. It combines
            a rich markdown note editor, a full kanban task manager, and a visual knowledge graph — all without requiring an
            account or sending any data to external servers.
          </p>
          <p>
            Everything lives on your device. Sync is optional and always encrypted end-to-end before leaving your machine.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--text-3))]">
              v0.0.0
            </span>
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--text-3))]">
              AGPL-3.0
            </span>
            <a
              href="https://github.com/AjilJagadeesh7/mindvault"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-2))] px-2.5 py-1 font-mono text-xs text-[rgb(var(--accent))] transition hover:underline"
            >
              GitHub <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </SectionCard>

      {/* Features */}
      <SectionCard title="Features">
        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]">
                <Icon size={14} />
              </span>
              <div>
                <p className="text-sm font-medium text-[rgb(var(--text))]">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--text-3))]">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Privacy Notice */}
      <SectionCard title="Privacy Notice">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[rgb(var(--accent))]" />
            <p className="text-xs leading-relaxed text-[rgb(var(--text-2))]">
              MindVault is designed to keep your data yours. Here is exactly what we do and do not do.
            </p>
          </div>
          <ul className="space-y-2">
            {PRIVACY_POINTS.map(point => (
              <li key={point} className="flex items-start gap-2 text-xs leading-relaxed text-[rgb(var(--text-2))]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--accent))]" />
                {point}
              </li>
            ))}
          </ul>
          <p className="pt-1 text-[11px] text-[rgb(var(--text-3))]">
            MindVault is open-source software released under the GNU Affero General Public License v3.0. You can read,
            audit, and modify the source code. Any modified version distributed over a network must also be made available
            under AGPL-3.0.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
