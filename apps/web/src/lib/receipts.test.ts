import { it, expect, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  upload: vi.fn<(...args: unknown[]) => Promise<{error: null}>>(async () => ({ error: null })),
  remove: vi.fn(async () => ({ error: null })),
  insert: vi.fn(),
}))
vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => mock }, from: () => mock },
}))
import { validateReceipt, uploadReceipt } from './supplier-requests'
it('rejects active document formats and empty/oversize files before uploading', () => {
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript'])
    expect(() => validateReceipt({ type, size: 100 })).toThrow()
  for (const size of [0, 10485761])
    expect(() => validateReceipt({ type: 'application/pdf', size })).toThrow()
  expect(() =>
    validateReceipt({ type: 'application/pdf', size: 10485760 }),
  ).not.toThrow()
})
it('cleans up a file if its receipt record could not be saved', async () => {
  mock.insert.mockResolvedValue({ error: new Error('Database unavailable') })
  await expect(
    uploadReceipt(
      new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }),
      'expense',
      'owner',
    ),
  ).rejects.toThrow('Database unavailable')
  const path = mock.upload.mock.calls[0]?.[0]
  expect(path).toMatch(/^owner\/expense\/.+\.pdf$/)
  expect(mock.remove).toHaveBeenCalledWith([path])
})
