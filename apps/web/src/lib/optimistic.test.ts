import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { OptimisticWrites, editRows, insertRow } from './optimistic'
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  client.setQueryData(
    ['items'],
    [
      { id: 'a', title: 'Old A' },
      { id: 'b', title: 'Old B' },
    ],
  )
  return { client, writes: new OptimisticWrites(client) }
}
function deferred() {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
afterEach(() => clients.splice(0).forEach((c) => c.clear()))
it('updates before the server resolves, then restores a rejected edit', async () => {
  const { client, writes } = setup()
  const server = deferred()
  const work = writes.run('a', [editRows(['items'], 'a', { title: 'New A' })], () => server.promise)
  const rejected = expect(work).rejects.toThrow('Denied')
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'New A' }))
  server.reject(new Error('Denied'))
  await rejected
  expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'Old A' })
})
it('a failed row does not undo a concurrent successful row', async () => {
  const { client, writes } = setup()
  const a = deferred()
  const b = deferred()
  const first = writes.run('a', [editRows(['items'], 'a', { title: 'New A' })], () => a.promise)
  const rejected = expect(first).rejects.toThrow('Denied')
  const second = writes.run('b', [editRows(['items'], 'b', { title: 'New B' })], () => b.promise)
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'b', title: 'New B' }))
  b.resolve()
  await second
  a.reject(new Error('Denied'))
  await rejected
  expect(client.getQueryData(['items'])).toEqual([
    { id: 'a', title: 'Old A' },
    { id: 'b', title: 'New B' },
  ])
})
it('serializes writes to the same record and rolls back only the failed successor', async () => {
  const { client, writes } = setup()
  const a = deferred()
  const b = deferred()
  const sendB = vi.fn(() => b.promise)
  const first = writes.run('a', [editRows(['items'], 'a', { title: 'First' })], () => a.promise)
  const second = writes.run('a', [editRows(['items'], 'a', { title: 'Second' })], sendB)
  const rejected = expect(second).rejects.toThrow('Failed')
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'Second' }))
  expect(sendB).not.toHaveBeenCalled()
  a.resolve()
  await first
  await waitFor(() => expect(sendB).toHaveBeenCalledTimes(1))
  b.reject(new Error('Failed'))
  await rejected
  expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'First' })
})
it('rebases pending edits over background refreshes and preserves unrelated remote changes', async () => {
  const { client, writes } = setup()
  const server = deferred()
  const work = writes.run('a', [editRows(['items'], 'a', { title: 'Local' })], () => server.promise)
  const rejected = expect(work).rejects.toThrow('Failed')
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'Local' }))
  client.setQueryData(
    ['items'],
    [
      { id: 'a', title: 'Server' },
      { id: 'b', title: 'Remote B' },
    ],
  )
  expect(client.getQueryData(['items'])).toEqual([
    { id: 'a', title: 'Local' },
    { id: 'b', title: 'Remote B' },
  ])
  server.reject(new Error('Failed'))
  await rejected
  expect(client.getQueryData(['items'])).toEqual([
    { id: 'a', title: 'Server' },
    { id: 'b', title: 'Remote B' },
  ])
})
it('shares pending edits with another view loaded while a save is running', async () => {
  const { client, writes } = setup()
  const server = deferred()
  const work = writes.run('a', [editRows(['items', 'detail'], 'a', { title: 'Local' })], () => server.promise)
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'Local' }))
  client.setQueryData(['detail', 'a'], { id: 'a', title: 'Old A' })
  expect(client.getQueryData(['detail', 'a'])).toEqual({ id: 'a', title: 'Local' })
  server.resolve()
  await work
})
it('does not duplicate a created row if realtime delivers it before the write returns', async () => {
  const { client, writes } = setup()
  const server = deferred()
  const work = writes.run('c', [insertRow(['items'], { id: 'c', title: 'New' })], () => server.promise)
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'c', title: 'New' }))
  client.setQueryData(['items'], [{ id: 'c', title: 'New' }])
  expect(client.getQueryData(['items'])).toEqual([{ id: 'c', title: 'New' }])
  server.resolve()
  await work
})
it('discards old-account overlays and queued writes when the account changes', async () => {
  const { client, writes } = setup()
  const server = deferred()
  const queued = vi.fn(async () => {})
  const first = writes.run('a', [editRows(['items'], 'a', { title: 'Private A' })], () => server.promise)
  const second = writes.run('a', [editRows(['items'], 'a', { title: 'Queued A' })], queued)
  const rejected = expect(second).rejects.toThrow('Account changed')
  await waitFor(() => expect(client.getQueryData(['items'])).toContainEqual({ id: 'a', title: 'Queued A' }))
  writes.reset()
  client.clear()
  client.setQueryData(['items'], [{ id: 'other', title: 'New account' }])
  server.resolve()
  await first
  await rejected
  expect(queued).not.toHaveBeenCalled()
  expect(client.getQueryData(['items'])).toEqual([{ id: 'other', title: 'New account' }])
})
