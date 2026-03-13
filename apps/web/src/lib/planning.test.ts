import { describe, expect, it } from 'vitest'
import { previewStructuredImpact } from './planning'

describe('previewStructuredImpact', () => {
  it('calculates minute delta and affected systems', () => {
    const result = previewStructuredImpact({
      updateType: 'booking changed',
      previousTime: '2026-03-12T10:00:00.000Z',
      nextTime: '2026-03-12T13:30:00.000Z',
      note: 'Keys ready later',
    })

    expect(result.deltaMinutes).toBe(210)
    expect(result.affected).toContain('helper arrival')
  })
})
