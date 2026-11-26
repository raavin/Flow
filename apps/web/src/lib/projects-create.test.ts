import { it, expect, vi } from 'vitest'
const db = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}))
vi.mock('./supabase', () => ({ supabase: db }))
vi.mock('./coordination', () => ({
  createNotification: vi.fn(),
  createActivity: vi.fn(),
}))
vi.mock('./coordination-objects', () => ({
  syncProjectCoordinationObject: vi.fn(),
}))
import { createProject } from './projects'
import { syncProjectCoordinationObject } from './coordination-objects'
it('keeps an idea without a target date off the calendar and does not invent milestones', async () => {
  db.from.mockReturnValue(db)
  db.insert.mockReturnValue(db)
  db.select.mockReturnValue(db)
  db.single.mockResolvedValue({
    data: {
      id: 'idea',
      title: 'New idea',
      category: 'General',
      project_kind: 'general',
      target_date: null,
      budget_cents: null,
      status: 'active',
    },
    error: null,
  })
  const project = await createProject({
    ownerId: 'owner',
    title: 'New idea',
    category: '',
    targetDate: '',
  })
  expect(project.targetDate).toBeNull()
  expect(db.insert).toHaveBeenCalledWith(
    expect.objectContaining({ target_date: null }),
  )
  expect(db.from).toHaveBeenCalledTimes(1)
  expect(syncProjectCoordinationObject).toHaveBeenCalledWith(
    expect.objectContaining({ targetDate: null }),
  )
})
