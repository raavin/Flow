import { expect, it } from 'vitest'
import { appDestination } from './navigation'

it('retains local pages, budget filters, search terms and anchors', () => {
  for (const path of [
    '/app/budgets?view=project%3A123',
    '/app/search?q=birthday%20dinner',
    '/app/projects/123/notes#latest',
  ])
    expect(appDestination(path)).toBe(path)
})
it.each([
  'https://evil.test/app/messages',
  '//evil.test',
  '/\\evil.test',
  'javascript:alert(1)',
  '/app/../../outside',
  '/app/%2e%2e/outside',
  '/app/%5cevil',
  '/app/messages%0a',
  '/app/%',
  null,
  {},
])('rejects unsafe destination %s', (path) => {
  expect(appDestination(path)).toBeUndefined()
})
