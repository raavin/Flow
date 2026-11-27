import { expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: db.from } }))
import { linkPostToProject } from './social'
it('links an owned message without changing its audience', async () => {
  db.from.mockReturnValue(db)
  db.update.mockReturnValue(db)
  db.eq.mockReturnValue({ ...db, error: null })
  await linkPostToProject({ postId: 'private-note', userId: 'owner', projectId: 'party' })
  expect(db.update).toHaveBeenCalledWith({ linked_project_id: 'party' })
  expect(db.eq).toHaveBeenCalledWith('author_id', 'owner')
})
