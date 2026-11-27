import { it, expect } from 'vitest'
import { sanitizeHtml } from './post-content'
it('keeps formatting and safe links while removing executable attributes and elements', () => {
  const clean = sanitizeHtml(
    '<p onclick="alert(1)"><strong>Hi</strong><img src=x onerror=alert(1)><svg onload=alert(1)></svg><a href="jav&#x61;script:alert(1)" onfocus="evil()">bad</a><a href="https://example.com">safe</a></p>',
  )
  expect(clean).toContain('<strong>Hi</strong>')
  expect(clean).toContain('href="https://example.com"')
  expect(clean).not.toMatch(/onclick|onerror|onload|onfocus|javascript|<img|<svg/)
})
it('drops embedded documents, forms and hidden scripting contexts', () => {
  expect(
    sanitizeHtml('<iframe srcdoc="x"></iframe><script>alert(1)</script><form><input></form><p>Keep this</p>'),
  ).toBe('<p>Keep this</p>')
})
