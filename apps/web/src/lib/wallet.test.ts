import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), eq: vi.fn(), from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: db.from } }))
vi.mock('./coordination', () => ({ createNotification: vi.fn(async () => {}) }))
import { createWalletEntry, updateWalletEntry, settleWalletEntry } from './wallet'
beforeEach(() => {
  vi.clearAllMocks()
  db.from.mockReturnValue(db)
  db.insert.mockResolvedValue({ error: null })
  db.update.mockReturnValue(db)
  db.eq.mockReturnValue({ ...db, error: null })
})
describe('manual money records', () => {
  it.each([['send', 'settled'], ['request', 'pending'], ['iou', 'pending']] as const)('records %s with status %s', async (entryKind, status) => {
    await createWalletEntry({ profileId: 'owner', entryKind, direction: 'out', amountCents: 4500, counterparty: 'Pat', reason: 'Party supplies' })
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ total_cents: 4500, status, transaction_role: 'manual' }))
  })
  it('edits real ledger amount columns and restricts updates to manual records', async () => {
    await updateWalletEntry('record', { amountCents: 4750 })
    expect(db.update).toHaveBeenCalledWith({ subtotal_cents: 4750, total_cents: 4750, seller_net_cents: 4750 })
    expect(db.eq).toHaveBeenCalledWith('transaction_role', 'manual')
  })
  it('does not settle marketplace payments via a manual record action', async () => {
    await settleWalletEntry('record')
    expect(db.eq).toHaveBeenCalledWith('transaction_role', 'manual')
  })
  it('rejects invalid amounts before writing', async () => {
    await expect(updateWalletEntry('record', { amountCents: NaN })).rejects.toThrow()
    expect(db.update).not.toHaveBeenCalled()
  })
})
