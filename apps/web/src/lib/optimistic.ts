import { type Query, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { queryClient } from './query-client'

export type CacheChange = {
  keys: string[]
  apply: (data: unknown, key: QueryKey) => unknown
}
type Layer = { change: CacheChange; state: 'pending' | 'saved' | 'failed' }
type Entry = { query: Query; base: unknown; layers: Layer[] }
type Transaction = { changes: CacheChange[]; touched: { entry: Entry; layers: Layer[] }[] }

// Overlapping writes replay their own patches rather than restoring a whole old
// snapshot. A failure in one row must not erase a successful edit in another.
export class OptimisticWrites {
  private entries = new Map<string, Entry>()
  private queues = new Map<string, Promise<unknown>>()
  private painting = false
  private active = new Set<Transaction>()
  private epoch = 0
  private listeners = new Set<() => void>()
  private snapshot = { pending: 0, failed: false }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  dismissError = () => {
    this.publish(false)
  }
  private publish(failed = this.snapshot.failed) {
    this.snapshot = { pending: this.active.size, failed }
    this.listeners.forEach((listener) => listener())
  }
  constructor(private client: QueryClient) {
    client.getQueryCache().subscribe((event) => {
      if (this.painting) return
      let entry = this.entries.get(event.query.queryHash)
      if (!entry && event.type === 'updated' && event.action.type === 'success') {
        // A second view opened during a save sees the same pending values.
        for (const transaction of this.active) {
          const changes = transaction.changes.filter((c) => c.keys.includes(String(event.query.queryKey[0])))
          if (!changes.length) continue
          entry ??= { query: event.query, base: event.query.state.data, layers: [] }
          const layers: Layer[] = changes.map((change) => ({ change, state: 'pending' }))
          entry.layers.push(...layers)
          transaction.touched.push({ entry, layers })
          this.entries.set(event.query.queryHash, entry)
        }
      }
      if (!entry) return
      if (event.type === 'removed') {
        this.entries.delete(event.query.queryHash)
      } else if (event.type === 'updated' && event.action.type === 'success') {
        // Realtime/background refreshes cannot erase an in-flight local edit.
        entry.base = event.query.state.data
        this.paint(entry)
      }
    })
  }
  reset() {
    ++this.epoch
    this.entries.clear()
    this.active.clear()
    this.queues.clear()
    this.publish(false)
  }
  private paint(entry: Entry) {
    let data = entry.base
    for (const layer of entry.layers)
      if (layer.state !== 'failed') data = layer.change.apply(data, entry.query.queryKey)
    this.painting = true
    try {
      entry.query.setData(data)
    } finally {
      this.painting = false
    }
  }
  async run<T>(scope: string, changes: CacheChange[], send: () => Promise<T>): Promise<T> {
    const epoch = this.epoch
    const matched = this.client.getQueryCache().findAll({
      predicate: (q) =>
        q.state.data !== undefined && changes.some((c) => c.keys.includes(String(q.queryKey[0]))),
    })
    await Promise.all(matched.map((q) => this.client.cancelQueries({ queryKey: q.queryKey, exact: true })))
    if (epoch !== this.epoch) throw new Error('Account changed. Please try again.')
    const touched: Transaction['touched'] = []
    for (const query of matched) {
      // Do not recreate a query cleared by sign-out while cancellation awaited.
      if (this.client.getQueryCache().get(query.queryHash) !== query) continue
      const entry = this.entries.get(query.queryHash) ?? { query, base: query.state.data, layers: [] }
      const layers = changes
        .filter((c) => c.keys.includes(String(query.queryKey[0])))
        .map((change) => ({ change, state: 'pending' as const }))
      entry.layers.push(...layers)
      this.entries.set(query.queryHash, entry)
      touched.push({ entry, layers })
      this.paint(entry)
    }
    // Preserve write order for the same record even if network responses differ.
    const transaction = { changes, touched }
    this.active.add(transaction)
    this.publish()
    const previous = this.queues.get(scope)
    const work = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => {
      if (epoch !== this.epoch) throw new Error('Account changed. Please try again.')
      return send()
    })
    this.queues.set(scope, work)
    let success = false
    try {
      const result = await work
      success = true
      return result
    } finally {
      this.active.delete(transaction)
      this.publish(this.snapshot.failed || (!success && epoch === this.epoch))
      if (this.queues.get(scope) === work) this.queues.delete(scope)
      for (const { entry, layers } of touched) {
        if (this.entries.get(entry.query.queryHash) !== entry) continue
        for (const layer of layers) layer.state = success ? 'saved' : 'failed'
        this.paint(entry)
        if (!entry.layers.some((l) => l.state === 'pending')) {
          this.painting = true
          try {
            entry.query.setData(
              mapRecords(entry.query.state.data, (row) => (row._pending ? { ...row, _pending: false } : row)),
            )
          } finally {
            this.painting = false
          }
          this.entries.delete(entry.query.queryHash)
          // Keep the predicted value visible while authoritative data reconciles.
          void this.client.invalidateQueries({ queryKey: entry.query.queryKey, exact: true })
        }
      }
    }
  }
}

export const optimisticWrites = new OptimisticWrites(queryClient)
export const optimisticWrite = <T>(scope: string, changes: CacheChange[], send: () => Promise<T>) =>
  optimisticWrites.run(scope, changes, send)

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
// Walk cached lists, infinite-query pages and detail objects without changing
// unrelated records. Apply functions must be idempotent (set values, not toggle).
export function mapRecords(data: unknown, transform: (row: Record<string, unknown>) => unknown): unknown {
  if (Array.isArray(data)) {
    const next = data.map((v) => mapRecords(v, transform)).filter((v) => v !== undefined)
    return next.length === data.length && next.every((v, i) => v === data[i]) ? data : next
  }
  if (!isObject(data)) return data
  let result = data
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      const next = mapRecords(value, transform)
      if (next !== value) result = { ...result, [key]: next }
    }
  }
  return transform(result)
}
export function editRows(keys: string[], id: string, values: Record<string, unknown>): CacheChange {
  const fields = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
  return { keys, apply: (data) => mapRecords(data, (row) => (row.id === id ? { ...row, ...fields } : row)) }
}
export function removeRows(keys: string[], id: string): CacheChange {
  return { keys, apply: (data) => mapRecords(data, (row) => (row.id === id ? undefined : row)) }
}
export function insertRow(
  keys: string[],
  row: Record<string, unknown>,
  matches: (key: QueryKey) => boolean = () => true,
): CacheChange {
  return {
    keys,
    apply: (data, key) =>
      matches(key) && Array.isArray(data) && !data.some((v) => isObject(v) && v.id === row.id)
        ? [...data, row]
        : data,
  }
}

export function cachedRow(keys: string[], id: string): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined
  for (const query of queryClient
    .getQueryCache()
    .findAll({ predicate: (q) => keys.includes(String(q.queryKey[0])) })) {
    mapRecords(query.state.data, (row) => {
      if (row.id === id) found ??= row
      return row
    })
  }
  return found
}
export function setFlag(
  keys: string[],
  id: string,
  field: string,
  value: boolean,
  count?: string,
): CacheChange {
  return {
    keys,
    apply: (data) =>
      mapRecords(data, (row) =>
        row.id !== id || row[field] === value
          ? row
          : {
              ...row,
              [field]: value,
              ...(count ? { [count]: Math.max(0, Number(row[count] ?? 0) + (value ? 1 : -1)) } : {}),
            },
      ),
  }
}

export function isPendingRecord(value: unknown): boolean {
  return isObject(value) && value._pending === true
}
