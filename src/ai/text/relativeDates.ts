/**
 * Relative dates are resolved in code, never by the model (PRD): before a
 * message reaches the model, "tomorrow" becomes "tomorrow (2026-10-09)".
 * The plan card then shows the exact date before anything is applied.
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** First `weekday` strictly after today. */
function nextWeekday(now: Date, weekday: number): Date {
  const diff = ((weekday - now.getDay() + 7) % 7) || 7
  return addDays(now, diff)
}

/** "Oct 12" → this year's date, or next year's when it has already passed. */
function monthDay(now: Date, month: number, day: number): Date | null {
  if (day < 1 || day > 31) return null
  let d = new Date(now.getFullYear(), month, day)
  if (d.getMonth() !== month) return null
  if (d < addDays(now, 0)) d = new Date(now.getFullYear() + 1, month, day)
  return d
}

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

type Rule = [RegExp, (now: Date, m: RegExpMatchArray) => Date | null]

const RULES: Rule[] = [
  [/\bday after tomorrow\b/gi, (now) => addDays(now, 2)],
  [/\btoday\b/gi, (now) => now],
  [/\btomorrow\b/gi, (now) => addDays(now, 1)],
  [/\byesterday\b/gi, (now) => addDays(now, -1)],
  [/\bin (\d{1,3}) days?\b/gi, (now, m) => addDays(now, Number(m[1]))],
  [/\bin (\d{1,2}) weeks?\b/gi, (now, m) => addDays(now, Number(m[1]) * 7)],
  [/\bnext week\b/gi, (now) => nextWeekday(now, 1)],
  [/\b(?:(?:this|next|on) )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    (now, m) => nextWeekday(now, WEEKDAYS.indexOf(m[1].toLowerCase()))],
  [new RegExp(`\\b${MONTH_RE} (\\d{1,2})(?:st|nd|rd|th)?\\b(?!,? \\d{4})`, 'gi'),
    (now, m) => monthDay(now, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]))],
  [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? ${MONTH_RE}\\b(?! \\d{4})`, 'gi'),
    (now, m) => monthDay(now, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]))],
]

/**
 * Appends the ISO date after every relative date phrase in `text`. Phrases
 * already followed by an ISO date are left alone, so this is idempotent.
 */
export function annotateRelativeDates(text: string, now: Date): string {
  let out = text
  for (const [re, resolve] of RULES) {
    out = out.replace(re, (...args) => {
      const match = args[0] as string
      const offset = args[args.length - 2] as number
      const whole = args[args.length - 1] as string
      if (/^\s*\(\d{4}-\d{2}-\d{2}\)/.test(whole.slice(offset + match.length))) return match
      const groups = args.slice(0, -2) as unknown as RegExpMatchArray
      const date = resolve(now, groups)
      return date ? `${match} (${isoDate(date)})` : match
    })
  }
  return out
}
