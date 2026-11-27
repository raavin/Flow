import { it, expect } from 'vitest'
import type { CoordinationObject } from '@superapp/types'
import { groupCoordinationObjects } from './task-groups'
const task = (id: string, state: string, start: string | null, end: string | null = null) =>
  ({
    id,
    kind: 'task',
    state,
    time: { startsAt: start, endsAt: end, dueAt: null },
  }) as CoordinationObject
it('puts every open task in one bucket, including overdue and ongoing ranges', () => {
  const result = groupCoordinationObjects(
    [
      task('overdue', 'scheduled', '2026-11-01'),
      task('ongoing', 'scheduled', '2026-11-20', '2026-12-20'),
      task('active', 'active', null),
      task('later', 'scheduled', '2027-01-01'),
      task('undated', 'pending', null),
      task('done', 'completed', '2026-11-27'),
    ],
    new Date('2026-11-27T12:00:00'),
  )
  expect(result.now.map((x) => x.id)).toEqual(['overdue', 'ongoing', 'active'])
  expect(result.next.map((x) => x.id)).toEqual(['later'])
  expect(result.backlog.map((x) => x.id)).toEqual(['undated'])
  expect(result.done.map((x) => x.id)).toEqual(['done'])
  expect(Object.values(result).flat()).toHaveLength(6)
})
