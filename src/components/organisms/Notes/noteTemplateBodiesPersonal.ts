/**
 * Markdown bodies for the study, research and personal note templates.
 * See noteTemplateBodiesWork.ts for the shared conventions.
 */
import type { TemplateDates } from './noteTemplateBodiesWork'

export function personalBodies({ shortDateYear }: TemplateDates): Record<string, string> {
  return {
    brainstorm: `### Question
_What exactly are we trying to solve?_

### Constraints
-

### Ideas
_Quantity first, no judging._
-
-
-

### Shortlist
| Idea | Impact | Effort | Verdict |
|------|--------|--------|---------|
| _Idea 1_ | _High_ | _Low_ | _Try it_ |
|  |  |  |  |

### Next steps
- [ ]
- [ ]
`,

    research: `### Question
_What am I trying to find out, and why does it matter?_

### Sources
| Source | Key finding |
|--------|-------------|
| _Author, "Title" (2024)_ | _—_ |
|  |  |

### Findings
-

### Open questions
- [ ]

### Conclusion
_What the evidence supports so far, and how confident I am._
`,

    learning: `- **Topic:**
- **Source:**

### Key ideas
-

### Terms
| Term | Meaning |
|------|---------|
| _—_ | _—_ |
|  |  |

### In my own words
_If I had to explain this to someone else, I'd say…_

### Review questions
1. _Question_
2.
`,

    book: `- **Author:**
- **Started / finished:**
- **Rating:** _/5_

### In one sentence
_What is this book actually about?_

### Key ideas
1.
2.
3.

### Quotes
>

### What I'll apply
- [ ]
`,

    todo: `- [ ]
- [ ]
- [ ]
`,

    habit: `_Week of ${shortDateYear}. Swap ☐ for ☑ as you go._

| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| _Read 20 min_ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
|  | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
|  | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

### Reflection
_What made it easy? What got in the way?_
-
`,

    weekly: `### Wins
-

### Challenges
-

### Lessons
-

### Next week
- [ ]
- [ ]
- [ ]
`,
  }
}
