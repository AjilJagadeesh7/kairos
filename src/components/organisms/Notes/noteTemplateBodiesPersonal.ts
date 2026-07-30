/**
 * Markdown bodies for the study, research and personal note templates.
 * See noteTemplateBodiesWork.ts for the shared conventions.
 */
import type { TemplateDates } from './noteTemplateBodiesWork'

export function personalBodies({ shortDateYear }: TemplateDates): Record<string, string> {
  return {
    brainstorm: `> [!ABSTRACT] The question
> _What exactly are we trying to solve?_

### 🚧 Constraints
- _Time, budget, people, anything fixed_
-

### 💡 Ideas — quantity first, no judging
-
-
-
-
-

### ⚖️ Shortlist
| Idea | Impact | Effort | Confidence | Verdict |
|------|--------|--------|------------|---------|
| _Idea 1_ | _High_ | _Low_ | _Medium_ | ✅ Try it |
|  |  |  |  |  |

### 🚀 Next steps
- [ ]
- [ ]
`,

    research: `> [!ABSTRACT] Research question
> _What am I trying to find out, and why does it matter?_

### 🌐 Background
-

### 📑 Sources
| Source | Type | Key finding | Trust |
|--------|------|-------------|-------|
| _Author, "Title" (2024)_ | _Paper_ | _—_ | _High_ |
|  |  |  |  |

### 🔬 Findings
#### _Finding 1_
- **Evidence:**
- **Caveats:**

#### _Finding 2_
- **Evidence:**

### ❓ Open questions
- [ ]
- [ ]

### 🧾 Conclusion
_What the evidence supports so far — and how confident I am._

### 🔗 Related notes
-
`,

    learning: `> [!ABSTRACT] Topic
> **Source:** —
> **Why I'm learning this:** —

### 🧠 Core concepts
#### _Concept 1_
- **In one line:**
- **Why it matters:**

#### _Concept 2_
- **In one line:**

### 🧪 Worked example
\`\`\`
// paste or write the example here
\`\`\`

### 📖 Key terms
| Term | Definition | Example |
|------|------------|---------|
| _—_ | _—_ | _—_ |
|  |  |  |

### 📝 In my own words
_If I had to explain this to someone else, I'd say…_

### 🔁 Review questions
1. **Q:** _…_
   **A:** _…_
2. **Q:**
   **A:**
3. **Q:**
   **A:**
`,

    book: `> [!ABSTRACT] Book details
> **Author:** —
> **Started / finished:** —
> **Rating:** ⭐⭐⭐☆☆

### ✏️ In one sentence
_What is this book actually about?_

### 🔑 Key ideas
1. **_The idea_** — _why it matters_
2.
3.

### ❝ Quotes
> _"The quote."_ — p. _00_

>

### 🎒 What I'll apply
- [ ]
- [ ]

### 🤔 What I'd push back on
-

### 📚 Related reading
-
`,

    todo: `### 🔴 Today
- [ ] _The one thing that must happen_
- [ ]

### 🟡 This week
- [ ]
- [ ]

### 🟢 Later / someday
- [ ]

### 📅 Scheduled
| Task | Due | Notes |
|------|-----|-------|
| _Renew domain_ | _—_ | _—_ |
|  |  |  |

### ✔️ Done
- [x] _Finished items land here_
`,

    habit: `> [!TIP] How to use this
> Tick a box each day. Aim for the streak, not perfection — miss once, never twice.

### 📅 Week of ${shortDateYear}
| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| _Read 20 min_ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| _Exercise_ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
|  | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### 🎯 Why these habits
-

### 📈 Review
- **Best streak:**
- **What made it easy:**
- **What got in the way:**
`,

    weekly: `### 🏆 Wins
-

### 🌧️ What didn't go well
-

### 🎓 Lessons learned
-

### 📊 Metrics
| Metric | Target | Actual | Trend |
|--------|--------|--------|-------|
| _Deep work hours_ | _15_ | _—_ | _↔_ |
|  |  |  |  |

### 🎯 Next week's top 3
- [ ]
- [ ]
- [ ]

### 🔋 Energy & mood
- **Energy (1–5):**
- **What drained me:**
- **What restored me:**

### 🗒️ Notes
-
`,
  }
}
