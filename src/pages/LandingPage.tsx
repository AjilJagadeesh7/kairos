import { useNavigate } from 'react-router-dom'
import { BookOpen, Network, Settings2 } from 'lucide-react'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <main className="flex h-full flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-text">MindVault</h1>
        <p className="mt-2 text-text2">Private-by-default notes, graph, and knowledge base</p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => navigate('/notes')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-8 py-6 transition hover:border-accent/40 hover:bg-surface2"
        >
          <BookOpen size={28} className="text-accent" />
          <span className="text-sm font-semibold text-text">Notes</span>
          <span className="text-xs text-text3">Write and browse notes</span>
        </button>

        <button
          onClick={() => navigate('/graph')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-8 py-6 transition hover:border-accent/40 hover:bg-surface2"
        >
          <Network size={28} className="text-accent" />
          <span className="text-sm font-semibold text-text">Graph</span>
          <span className="text-xs text-text3">Explore connections</span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-8 py-6 transition hover:border-accent/40 hover:bg-surface2"
        >
          <Settings2 size={28} className="text-accent" />
          <span className="text-sm font-semibold text-text">Settings</span>
          <span className="text-xs text-text3">Configure your vault</span>
        </button>
      </div>
    </main>
  )
}
