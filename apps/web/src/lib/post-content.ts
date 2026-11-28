import { hasUnsafeUrlCharacters } from './navigation'

// Rebuild a small, inert HTML allowlist. Never forward arbitrary attributes.
export function sanitizeHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const output = document.createElement('div')
  const allowed = new Set([
    'P',
    'BR',
    'STRONG',
    'B',
    'EM',
    'I',
    'U',
    'S',
    'UL',
    'OL',
    'LI',
    'BLOCKQUOTE',
    'CODE',
    'PRE',
    'H2',
    'H3',
    'A',
  ])
  const blocked = new Set([
    'SCRIPT',
    'STYLE',
    'SVG',
    'MATH',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'FORM',
    'INPUT',
    'BUTTON',
    'TEXTAREA',
    'SELECT',
    'TEMPLATE',
  ])
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ''))
      return
    }
    if (!(node instanceof Element) || blocked.has(node.tagName)) return
    let target = parent
    if (allowed.has(node.tagName)) {
      const element = document.createElement(node.tagName.toLowerCase())
      if (node.tagName === 'A') {
        const href = node.getAttribute('href')?.trim() ?? ''
        if (
          !hasUnsafeUrlCharacters(href) &&
          (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^\/(?!\/)/.test(href))
        ) {
          element.setAttribute('href', href)
          element.setAttribute('rel', 'nofollow noopener noreferrer')
        }
      }
      parent.appendChild(element)
      target = element
    }
    Array.from(node.childNodes).forEach((child) => copy(child, target))
  }
  Array.from(parsed.body.childNodes).forEach((node) => copy(node, output))
  return output.innerHTML
}
export function postPlainText(html: string) {
  const body = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html').body
  body.querySelectorAll('p, li, h2, h3, blockquote, pre, br').forEach((element) => element.append(' '))
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
