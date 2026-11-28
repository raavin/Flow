import { it, expect } from 'vitest'
import { sanitizeHtml, postPlainText } from './post-content'
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

it('keeps paragraph boundaries in search and source previews', () => {
  expect(postPlainText('<p>Birthday</p><p>Buy a present<br>Book dinner</p>')).toBe(
    'Birthday Buy a present Book dinner',
  )
})
it('removes control and backslash URL tricks', () => {
  expect(
    sanitizeHtml('<a href="/\\evil.test">bad</a><a href="java&#10;script:alert(1)">bad</a>'),
  ).not.toContain('href=')
})
