// MindVault Note Stats Plugin v2.0.0
// Vault-wide statistics: word/char counts, top tags, writing streak, most linked notes.

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function computeStats(notes) {
  const now = new Date()
  const todayMs = startOfDay(now)
  const weekMs  = todayMs - 6 * 86400000   // 7 days including today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  let totalWords = 0
  let totalChars = 0
  const tagCount = {}
  const linkCount = {}   // title → number of times linked-to
  const updatedDays = new Set()
  let createdThisWeek  = 0
  let createdThisMonth = 0

  for (const note of notes) {
    const full = api_ref.notes.get(note.id)
    const content = full ? full.content : ''

    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    totalWords += words
    totalChars += content.length

    for (const tag of note.tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    }

    // Track days with updates (for streak)
    const updMs = new Date(note.updatedAt).getTime()
    updatedDays.add(isoDate(new Date(updMs)))

    // Notes created this week / month
    const creMs = new Date(note.createdAt).getTime()
    if (creMs >= weekMs)  createdThisWeek++
    if (creMs >= monthStart) createdThisMonth++

    // Count wikilinks
    WIKILINK_RE.lastIndex = 0
    let m
    while ((m = WIKILINK_RE.exec(content)) !== null) {
      const linkedTitle = m[1].trim()
      linkCount[linkedTitle] = (linkCount[linkedTitle] || 0) + 1
    }
  }

  // Writing streak: count consecutive days ending today with at least one update
  let streak = 0
  const d = new Date(now)
  while (true) {
    if (updatedDays.has(isoDate(d))) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  // Top 10 tags
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Most linked notes (top 8)
  const mostLinked = Object.entries(linkCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const avgWords = notes.length ? Math.round(totalWords / notes.length) : 0

  return {
    totalNotes: notes.length,
    totalWords,
    totalChars,
    avgWords,
    topTags,
    mostLinked,
    streak,
    createdThisWeek,
    createdThisMonth,
  }
}

// We need a module-level reference so computeStats can call api.notes.get
let api_ref = null

export default function setup(api) {
  api_ref = api
  const React = api.React
  const { SectionCard } = api.components

  function StatsPage() {
    const [stats, setStats] = React.useState(null)

    function refresh() {
      const notes = api.notes.list()
      setStats(computeStats(notes))
    }

    React.useEffect(() => {
      refresh()
    }, [])

    React.useEffect(() => {
      const h = () => refresh()
      api.on('note:created', h)
      api.on('note:updated', h)
      api.on('note:deleted', h)
      return () => {
        api.off('note:created', h)
        api.off('note:updated', h)
        api.off('note:deleted', h)
      }
    }, [])

    if (!stats) {
      return React.createElement('div', {
        style: { padding: '2rem', textAlign: 'center', color: 'rgb(var(--text-3))' }
      }, 'Loading stats…')
    }

    const statItemStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '1rem',
      borderRadius: '0.75rem',
      border: '1px solid rgb(var(--border))',
      background: 'rgb(var(--surface))',
      minWidth: 100,
      flex: 1,
    }

    const bigNumStyle = {
      fontSize: '2rem',
      fontWeight: 700,
      color: 'rgb(var(--text))',
      lineHeight: 1,
      marginBottom: '0.25rem',
    }

    const labelStyle = {
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'rgb(var(--text-3))',
      textAlign: 'center',
    }

    function StatCard(value, label) {
      return React.createElement('div', { style: statItemStyle },
        React.createElement('span', { style: bigNumStyle }, value),
        React.createElement('span', { style: labelStyle }, label),
      )
    }

    return React.createElement('div', { style: { padding: '1.5rem', maxWidth: 700, margin: '0 auto' } },
      React.createElement('h1', {
        style: { fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'rgb(var(--text))' }
      }, 'Vault Stats'),

      // Overview grid
      React.createElement('div', { style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' } },
        StatCard(stats.totalNotes.toLocaleString(), 'Notes'),
        StatCard(stats.totalWords.toLocaleString(), 'Words'),
        StatCard(stats.totalChars.toLocaleString(), 'Characters'),
        StatCard(stats.avgWords.toLocaleString(), 'Avg Words'),
      ),

      // Activity row
      React.createElement('div', { style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' } },
        StatCard(stats.streak, `Day streak${stats.streak === 1 ? '' : 's'}`),
        StatCard(stats.createdThisWeek, 'This week'),
        StatCard(stats.createdThisMonth, 'This month'),
      ),

      // Top tags
      stats.topTags.length > 0 && React.createElement('div', {
        style: { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }
      },
        React.createElement('p', {
          style: { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(var(--text-3))', marginBottom: '0.75rem' }
        }, 'Top Tags'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' } },
          stats.topTags.map(([tag, count]) =>
            React.createElement('span', {
              key: tag,
              style: {
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.2rem 0.625rem',
                borderRadius: '9999px',
                background: 'rgb(var(--surface-2))',
                border: '1px solid rgb(var(--border))',
                fontSize: '0.8rem',
                color: 'rgb(var(--text-2))',
              }
            },
              React.createElement('span', { style: { color: 'rgb(var(--accent))' } }, '#' + tag),
              React.createElement('span', { style: { color: 'rgb(var(--text-3))', fontSize: '0.7rem' } }, count)
            )
          )
        )
      ),

      // Most linked notes
      stats.mostLinked.length > 0 && React.createElement('div', {
        style: { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: '0.75rem', padding: '1rem 1.25rem' }
      },
        React.createElement('p', {
          style: { fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(var(--text-3))', marginBottom: '0.75rem' }
        }, 'Most Linked Notes'),
        React.createElement('ul', { style: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' } },
          stats.mostLinked.map(([title, count]) => {
            const found = api.notes.list().find(n => n.title === title)
            return React.createElement('li', {
              key: title,
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.5rem', borderRadius: '0.375rem' }
            },
              found
                ? React.createElement('button', {
                    type: 'button',
                    onClick: () => window.dispatchEvent(new CustomEvent('mv:navigate', { detail: { path: '/notes/' + found.id } })),
                    style: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--accent))', fontSize: '0.875rem', padding: 0 }
                  }, title)
                : React.createElement('span', { style: { fontSize: '0.875rem', color: 'rgb(var(--text-2))' } }, title),
              React.createElement('span', {
                style: { fontSize: '0.75rem', color: 'rgb(var(--text-3))', fontWeight: 500 }
              }, count + ' link' + (count !== 1 ? 's' : ''))
            )
          })
        )
      )
    )
  }

  api.registerPage({
    path: '/stats',
    navLabel: 'Stats',
    component: StatsPage,
  })
}
