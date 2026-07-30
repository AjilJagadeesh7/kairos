import { Icon } from '../../../icons/Icon'
import { workBodies, type TemplateDates } from './noteTemplateBodiesWork'
import { personalBodies } from './noteTemplateBodiesPersonal'
import type { NoteTemplate } from '../../../types'

/**
 * Template metadata. The markdown bodies live in the two sibling
 * `noteTemplateBodies*.ts` files so no file breaks the 300-line limit.
 */
export function makeTemplates(): NoteTemplate[] {
  const d = new Date()
  const dates: TemplateDates = {
    longDate:      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    shortDate:     d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    shortDateYear: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  }

  const body = { ...workBodies(dates), ...personalBodies(dates) }

  return [
    {
      id: 'blank',
      name: 'Blank',
      description: 'Start with an empty note',
      icon: <Icon name="file-text" size={18} />,
      title: '',
      content: '',
    },
    {
      id: 'meeting',
      name: 'Meeting Notes',
      description: 'Agenda table, decisions, action items',
      icon: <Icon name="calendar-days" size={18} />,
      title: 'Meeting — ',
      content: body.meeting,
    },
    {
      id: 'oneonone',
      name: '1:1',
      description: 'Talking points, goals check-in, feedback',
      icon: <Icon name="users" size={18} />,
      title: '1:1 with ',
      content: body.oneonone,
    },
    {
      id: 'standup',
      name: 'Daily Standup',
      description: 'Yesterday, today, blockers table',
      icon: <Icon name="zap" size={18} />,
      title: `Standup ${dates.shortDate}`,
      content: body.standup,
    },
    {
      id: 'project',
      name: 'Project Plan',
      description: 'Milestones, workstreams, risk register',
      icon: <Icon name="bar-chart-2" size={18} />,
      title: 'Project: ',
      content: body.project,
    },
    {
      id: 'decision',
      name: 'Decision Record',
      description: 'Context, options compared, consequences',
      icon: <Icon name="git-fork" size={18} />,
      title: 'Decision: ',
      content: body.decision,
    },
    {
      id: 'bug',
      name: 'Bug Report',
      description: 'Environment, repro steps, fix checklist',
      icon: <Icon name="bug" size={18} />,
      title: 'Bug: ',
      content: body.bug,
    },
    {
      id: 'brainstorm',
      name: 'Brainstorm',
      description: 'Ideas, scored shortlist, next steps',
      icon: <Icon name="lightbulb" size={18} />,
      title: 'Brainstorm: ',
      content: body.brainstorm,
    },
    {
      id: 'research',
      name: 'Research Note',
      description: 'Source table, findings, open questions',
      icon: <Icon name="flask-conical" size={18} />,
      title: 'Research: ',
      content: body.research,
    },
    {
      id: 'learning',
      name: 'Study Notes',
      description: 'Concepts, key terms, review questions',
      icon: <Icon name="graduation-cap" size={18} />,
      title: 'Notes: ',
      content: body.learning,
    },
    {
      id: 'book',
      name: 'Book Notes',
      description: 'Key ideas, quotes, what to apply',
      icon: <Icon name="book-open" size={18} />,
      title: 'Book: ',
      content: body.book,
    },
    {
      id: 'todo',
      name: 'To-Do List',
      description: 'Prioritised checklist + scheduled table',
      icon: <Icon name="check-square" size={18} />,
      title: 'To-Do: ',
      content: body.todo,
    },
    {
      id: 'habit',
      name: 'Habit Tracker',
      description: 'Weekly grid with a streak review',
      icon: <Icon name="crosshair" size={18} />,
      title: `Habits — week of ${dates.shortDateYear}`,
      content: body.habit,
    },
    {
      id: 'weekly',
      name: 'Weekly Review',
      description: 'Wins, lessons, metrics, next week',
      icon: <Icon name="history" size={18} />,
      title: `Week of ${dates.shortDateYear}`,
      content: body.weekly,
    },
  ]
}
